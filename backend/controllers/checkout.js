const db = require('../db');
const { logAuditAction } = require('../middleware/auditLogger');

const safeBigInt = (val) => {
    const num = Math.round(Number(val) || 0);
    return BigInt(num);
};

exports.processCheckout = async (req, res) => {
    const { items, customer_id, discount_id, pay_later_amount, discount_amount } = req.body;
    
    if (!items || items.length === 0) {
        return res.status(400).json({ status: 'ERROR', message: 'Cart is empty' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        let totalAmount = 0n;
        let totalProfit = 0n;
        const processedItems = [];

        // Verify and process items
        for (const item of items) {
            const itemQty = Math.max(0.001, parseFloat(item.quantity) || 1);
            if (item.is_custom || (item.barcode && item.barcode.startsWith('CUSTOM'))) {
                const customPrice = Math.max(0, Math.round(Number(item.price || item.selling_price) || 0));
                const itemSellTotal = Math.round(customPrice * itemQty);
                totalAmount += safeBigInt(itemSellTotal);
                totalProfit += safeBigInt(itemSellTotal);
                processedItems.push({
                    is_custom: true,
                    name: item.name || 'کاڵای دەستی / گشتی',
                    quantity: itemQty,
                    price: customPrice
                });
            } else {
                const [rows] = await connection.query('SELECT id, stock, selling_price, cost_price FROM Products WHERE barcode = ? FOR UPDATE', [item.barcode]);
                
                if (rows.length === 0) {
                    throw new Error(`Product not found: ${item.barcode}`);
                }

                const product = rows[0];
                const regularPrice = Number(product.selling_price);
                const costPrice = Number(product.cost_price || 0);

                // Check for active promotion on this product
                const [promos] = await connection.query(`
                    SELECT * FROM Promotions 
                    WHERE product_id = ? 
                      AND is_active = TRUE 
                      AND CURDATE() BETWEEN start_date AND end_date
                    ORDER BY id DESC LIMIT 1
                `, [product.id]);

                let itemSellTotal = 0;
                let effectivePriceAtSale = regularPrice;

                if (promos.length > 0) {
                    const promo = promos[0];
                    let promoPrice = regularPrice;
                    if (promo.discount_type === 'PERCENT') {
                        promoPrice = Math.max(0, Math.round(regularPrice - (regularPrice * Number(promo.discount_value)) / 100));
                    } else {
                        promoPrice = Math.max(0, Math.round(Number(promo.discount_value)));
                    }

                    const maxLimit = promo.max_qty_per_sale ? Number(promo.max_qty_per_sale) : Infinity;
                    const promoQty = Math.min(itemQty, maxLimit);
                    const regularQty = Math.max(0, itemQty - promoQty);

                    itemSellTotal = Math.round((promoQty * promoPrice) + (regularQty * regularPrice));
                    effectivePriceAtSale = itemQty > 0 ? Math.round(itemSellTotal / itemQty) : promoPrice;
                } else {
                    itemSellTotal = Math.round(regularPrice * itemQty);
                }

                const itemCostTotal = Math.round(costPrice * itemQty);
                totalAmount += safeBigInt(itemSellTotal);
                totalProfit += safeBigInt(itemSellTotal - itemCostTotal);

                // Deduct stock (supports decimal quantities for weight/scale)
                await connection.query('UPDATE Products SET stock = stock - ? WHERE barcode = ?', [itemQty, item.barcode]);

                processedItems.push({
                    is_custom: false,
                    productId: product.id,
                    quantity: itemQty,
                    price: effectivePriceAtSale
                });
            }
        }

        const subtotal = totalAmount;
        const discountVal = safeBigInt(discount_amount || 0);
        const finalTotal = subtotal > discountVal ? (subtotal - discountVal) : 0n;
        const finalProfit = totalProfit > discountVal ? (totalProfit - discountVal) : 0n;

        // Insert Sale with discount tracking
        const [saleResult] = await connection.query(
            'INSERT INTO Sales (total_amount, total_profit, subtotal_amount, discount_amount, customer_id, discount_id) VALUES (?, ?, ?, ?, ?, ?)',
            [finalTotal.toString(), finalProfit.toString(), subtotal.toString(), discountVal.toString(), customer_id || null, discount_id || null]
        );
        const saleId = saleResult.insertId;

        // Insert Sale Items
        for (const item of processedItems) {
            if (item.is_custom) {
                const [customProdRows] = await connection.query('SELECT id FROM Products WHERE barcode = ?', ['CUSTOM_ITEM']);
                const customProductId = customProdRows.length > 0 ? customProdRows[0].id : 1;

                await connection.query(
                    'INSERT INTO Sale_Items (sale_id, product_id, quantity, price_at_sale, custom_name) VALUES (?, ?, ?, ?, ?)',
                    [saleId, customProductId, item.quantity, item.price, item.name]
                );
            } else {
                await connection.query(
                    'INSERT INTO Sale_Items (sale_id, product_id, quantity, price_at_sale) VALUES (?, ?, ?, ?)',
                    [saleId, item.productId, item.quantity, item.price]
                );
            }
        }

        // Handle Customer Debt
        if (customer_id && pay_later_amount > 0) {
            await connection.query(
                'INSERT INTO Customer_Debts (customer_id, amount, transaction_type) VALUES (?, ?, ?)',
                [customer_id, safeBigInt(pay_later_amount).toString(), 'ADD']
            );
        }

        await connection.commit();

        // Audit log manual discount if applied
        if (discountVal > 0n) {
            await logAuditAction({
                req,
                action_type: 'DISCOUNT_APPLIED',
                entity_name: 'Sales',
                entity_id: saleId,
                new_value: { discount_amount: discountVal.toString(), final_total: finalTotal.toString() },
                details: `داشکاندنی دەستی لە کاشێر بۆ پسووڵەی #${saleId}: بڕی ${Number(discountVal).toLocaleString()} دینار (کۆی گشتی: ${Number(finalTotal).toLocaleString()} د.ع)`
            });
        }
        res.status(201).json({ 
            status: 'SUCCESS', 
            saleId: saleId, 
            subtotal: subtotal.toString(),
            discount: discountVal.toString(),
            total: finalTotal.toString(),
            message: 'Checkout complete' 
        });

    } catch (error) {
        await connection.rollback();
        console.error('Checkout Transaction Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    } finally {
        connection.release();
    }
};

exports.getAllSales = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT s.*, 
                   COALESCE(c.name, 'کڕیاری گشتی') as customer_name, 
                   c.phone as customer_phone,
                   COUNT(si.id) as item_count
            FROM Sales s
            LEFT JOIN Customers c ON s.customer_id = c.id
            LEFT JOIN Sale_Items si ON s.id = si.sale_id
            GROUP BY s.id
            ORDER BY s.created_at DESC
        `);
        res.json({ status: 'SUCCESS', data: rows });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.getSaleDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const [sale] = await db.query(`
            SELECT s.*, 
                   COALESCE(c.name, 'کڕیاری گشتی') as customer_name, 
                   c.phone as customer_phone
            FROM Sales s
            LEFT JOIN Customers c ON s.customer_id = c.id
            WHERE s.id = ?
        `, [id]);

        if (sale.length === 0) return res.status(404).json({ status: 'ERROR', message: 'Sale not found' });

        const [items] = await db.query(`
            SELECT si.*, COALESCE(si.custom_name, p.name) as product_name, p.barcode
            FROM Sale_Items si
            JOIN Products p ON si.product_id = p.id
            WHERE si.sale_id = ?
        `, [id]);

        res.json({ status: 'SUCCESS', data: { ...sale[0], items } });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};
