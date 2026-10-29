const db = require('../db');
const { logAuditAction } = require('../middleware/auditLogger');
const { queueSyncEvent } = require('./sync');

const safeBigInt = (val) => {
    const num = Math.round(Number(val) || 0);
    return BigInt(num);
};

const ensureBatchesSchema = async () => {
    try {
        try { await db.query("ALTER TABLE Product_Batches ADD COLUMN units_per_box DECIMAL(10,3) NOT NULL DEFAULT 1.000"); } catch (_) {}
    } catch (_) {}
};
ensureBatchesSchema();

exports.processCheckout = async (req, res) => {
    const { items, customer_id, discount_id, pay_later_amount, discount_amount, paid_amount, payment_method } = req.body;
    
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
                const [rows] = await connection.query(
                    'SELECT id, name, stock, selling_price, cost_price, wholesale_price, barcode, box_barcode, units_per_box, is_weighted FROM Products WHERE barcode = ? OR box_barcode = ? FOR UPDATE', 
                    [item.barcode, item.barcode]
                );
                
                if (rows.length === 0) {
                    throw new Error(`Product not found: ${item.barcode}`);
                }

                const product = rows[0];

                // Detect if this line item is a carton/box
                const isBox = (item.unit_type === 'BOX') || (Boolean(product.box_barcode) && String(product.box_barcode).trim() === String(item.barcode).trim());

                // --- FIFO Batch Depletion & Accurate Profit Logic ---
                // Query active FIFO batches for this product in chronological order
                const [activeBatches] = await connection.query(`
                    SELECT id, remaining_quantity, cost_price, selling_price, units_per_box, batch_number
                    FROM Product_Batches
                    WHERE product_id = ? AND status = 'ACTIVE' AND remaining_quantity > 0
                    ORDER BY created_at ASC, id ASC
                    FOR UPDATE
                `, [product.id]);

                // Active FIFO batch currently selling from
                const activeBatch = activeBatches.length > 0 ? activeBatches[0] : null;

                // CRITICAL FIFO ACCOUNTING INTEGRITY:
                // When deducting stock or calculating carton prices during a sale, the POS MUST multiply by
                // the specific units_per_box of the active FIFO batch it is selling from.
                // It MUST NEVER fall back to the global product.units_per_box.
                const activeBatchUnitsPerBox = (activeBatch && parseFloat(activeBatch.units_per_box) > 0)
                    ? parseFloat(activeBatch.units_per_box)
                    : 1;

                const unitsPerBox = isBox ? activeBatchUnitsPerBox : 1;
                const stockDeductionQty = isBox ? (itemQty * unitsPerBox) : itemQty;

                // Strict Stock Enforcement (Permanently active: cannot sell without sufficient inventory)
                if (!product.is_weighted && Number(product.stock) < stockDeductionQty) {
                    throw new Error(`بڕی بەردەستی (${item.name || product.name || 'کاڵا'}) لە کۆگا بەشی فرۆشتن ناکات`);
                }

                const regularPrice = (activeBatch && activeBatch.selling_price)
                    ? Number(activeBatch.selling_price)
                    : Number(product.selling_price);

                let itemSellTotal = 0;
                let effectivePriceAtSale = regularPrice;

                if (isBox) {
                    // Carton / wholesale price calculation: MUST multiply by the specific units_per_box of the active FIFO batch
                    const cartonPrice = Number(product.wholesale_price) > 0 
                        ? Number(product.wholesale_price) 
                        : Math.round(regularPrice * unitsPerBox);
                    effectivePriceAtSale = cartonPrice;
                    itemSellTotal = Math.round(cartonPrice * itemQty);
                } else {
                    // Check for active promotion on this single unit product
                    const [promos] = await connection.query(`
                        SELECT * FROM Promotions 
                        WHERE product_id = ? 
                          AND is_active = TRUE 
                          AND CURDATE() BETWEEN start_date AND end_date
                        ORDER BY id DESC LIMIT 1
                    `, [product.id]);

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
                }

                let remainingToDeduct = Number(stockDeductionQty);
                let itemCostTotal = 0;
                const itemBatchAllocations = [];

                for (const batch of activeBatches) {
                    if (remainingToDeduct <= 0) break;

                    const batchAvailable = Number(batch.remaining_quantity);
                    const deductQty = Math.min(remainingToDeduct, batchAvailable);
                    const batchUnitCost = Number(batch.cost_price || 0);

                    itemCostTotal += Math.round(deductQty * batchUnitCost);
                    remainingToDeduct -= deductQty;

                    const newRemaining = batchAvailable - deductQty;
                    const newStatus = newRemaining <= 0 ? 'EXHAUSTED' : 'ACTIVE';

                    await connection.query(`
                        UPDATE Product_Batches
                        SET remaining_quantity = ?, status = ?
                        WHERE id = ?
                    `, [newRemaining, newStatus, batch.id]);

                    itemBatchAllocations.push({
                        batch_id: batch.id,
                        quantity_deducted: deductQty,
                        unit_cost_price: batchUnitCost,
                        total_cost: Math.round(deductQty * batchUnitCost)
                    });
                }

                // Fallback: If remaining stock to deduct exceeds recorded active batches
                if (remainingToDeduct > 0) {
                    const fallbackCost = Number(product.cost_price || 0);
                    itemCostTotal += Math.round(remainingToDeduct * fallbackCost);
                }

                totalAmount += safeBigInt(itemSellTotal);
                totalProfit += safeBigInt(itemSellTotal - itemCostTotal);

                // Deduct stock (actual single units: carton quantity * unitsPerBox)
                await connection.query('UPDATE Products SET stock = stock - ? WHERE id = ?', [stockDeductionQty, product.id]);

                processedItems.push({
                    is_custom: false,
                    productId: product.id,
                    quantity: itemQty,
                    price: effectivePriceAtSale,
                    unit_type: isBox ? 'BOX' : 'PIECE',
                    units_per_box: unitsPerBox,
                    batchAllocations: itemBatchAllocations
                });
            }
        }

        const subtotal = totalAmount;
        const discountVal = safeBigInt(discount_amount || 0);
        const finalTotal = subtotal > discountVal ? (subtotal - discountVal) : 0n;
        // True signed net profit: discounts below cost legitimately result in negative profit (loss)
        const finalProfit = totalProfit - discountVal;

        // Determine Payment Mode and Breakdowns
        let method = (payment_method || '').toUpperCase();
        let finalPaidAmount = 0n;
        let finalDebtAmount = 0n;

        if (method === 'DEBT') {
            if (!customer_id) {
                throw new Error('تکایە سەرەتا کڕیارێک دیاریبکە بۆ فرۆشتن بە قەرز');
            }
            finalDebtAmount = finalTotal;
            finalPaidAmount = 0n;
        } else if (method === 'SPLIT') {
            if (!customer_id) {
                throw new Error('تکایە سەرەتا کڕیارێک دیاریبکە بۆ فرۆشتنی تێکەڵ (نەقد + قەرز)');
            }
            const inputPaid = safeBigInt(paid_amount || 0);
            const inputDebt = safeBigInt(pay_later_amount || 0);

            if (inputPaid > 0n && inputDebt > 0n) {
                finalPaidAmount = inputPaid;
                finalDebtAmount = inputDebt;
                if (finalPaidAmount + finalDebtAmount !== finalTotal) {
                    finalDebtAmount = finalTotal > finalPaidAmount ? (finalTotal - finalPaidAmount) : 0n;
                }
            } else if (inputPaid > 0n) {
                finalPaidAmount = inputPaid > finalTotal ? finalTotal : inputPaid;
                finalDebtAmount = finalTotal - finalPaidAmount;
            } else if (inputDebt > 0n) {
                finalDebtAmount = inputDebt > finalTotal ? finalTotal : inputDebt;
                finalPaidAmount = finalTotal - finalDebtAmount;
            } else {
                finalPaidAmount = safeBigInt(Math.floor(Number(finalTotal) / 2));
                finalDebtAmount = finalTotal - finalPaidAmount;
            }
        } else {
            // Check legacy pay_later_amount
            if (pay_later_amount && safeBigInt(pay_later_amount) > 0n) {
                if (!customer_id) {
                    throw new Error('تکایە سەرەتا کڕیارێک دیاریبکە بۆ فرۆشتن بە قەرز');
                }
                finalDebtAmount = safeBigInt(pay_later_amount);
                finalPaidAmount = finalTotal > finalDebtAmount ? (finalTotal - finalDebtAmount) : 0n;
                method = finalPaidAmount > 0n ? 'SPLIT' : 'DEBT';
            } else {
                method = 'CASH';
                finalPaidAmount = finalTotal;
                finalDebtAmount = 0n;
            }
        }

        // Insert Sale with discount and split payment tracking
        const [saleResult] = await connection.query(
            'INSERT INTO Sales (total_amount, total_profit, subtotal_amount, discount_amount, customer_id, discount_id, paid_amount, debt_amount, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                finalTotal.toString(), 
                finalProfit.toString(), 
                subtotal.toString(), 
                discountVal.toString(), 
                customer_id || null, 
                discount_id || null,
                finalPaidAmount.toString(),
                finalDebtAmount.toString(),
                method
            ]
        );
        const saleId = saleResult.insertId;

        // Insert Sale Items
        for (const item of processedItems) {
            if (item.is_custom) {
                const [customProdRows] = await connection.query('SELECT id FROM Products WHERE barcode = ?', ['CUSTOM_ITEM']);
                const customProductId = customProdRows.length > 0 ? customProdRows[0].id : 1;

                await connection.query(
                    'INSERT INTO Sale_Items (sale_id, product_id, quantity, price_at_sale, custom_name, unit_type, units_per_box) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [saleId, customProductId, item.quantity, item.price, item.name, 'PIECE', 1]
                );
            } else {
                const [itemResult] = await connection.query(
                    'INSERT INTO Sale_Items (sale_id, product_id, quantity, price_at_sale, unit_type, units_per_box) VALUES (?, ?, ?, ?, ?, ?)',
                    [saleId, item.productId, item.quantity, item.price, item.unit_type || 'PIECE', item.units_per_box || 1]
                );
                const saleItemId = itemResult.insertId;

                // Record FIFO batch allocations in Sale_Item_Batches
                if (item.batchAllocations && item.batchAllocations.length > 0) {
                    for (const alloc of item.batchAllocations) {
                        await connection.query(`
                            INSERT INTO Sale_Item_Batches (
                                sale_id,
                                sale_item_id,
                                batch_id,
                                quantity_deducted,
                                unit_cost_price,
                                total_cost
                            ) VALUES (?, ?, ?, ?, ?, ?)
                        `, [
                            saleId,
                            saleItemId,
                            alloc.batch_id,
                            alloc.quantity_deducted,
                            alloc.unit_cost_price,
                            alloc.total_cost
                        ]);
                    }
                }
            }
        }

        // Handle Customer Debt
        if (customer_id && finalDebtAmount > 0n) {
            const debtNote = method === 'SPLIT'
                ? `پسووڵەی #${saleId} (تێکەڵ: نەقد ${Number(finalPaidAmount).toLocaleString()} د.ع + قەرز ${Number(finalDebtAmount).toLocaleString()} د.ع)`
                : `پسووڵەی #${saleId} (فرۆشتنی قەرز)`;

            await connection.query(
                'INSERT INTO Customer_Debts (customer_id, sale_id, amount, transaction_type, note) VALUES (?, ?, ?, ?, ?)',
                [customer_id, saleId, finalDebtAmount.toString(), 'ADD', debtNote]
            );
        }

        await connection.commit();

        // Queue Sale for Offline & Online Sync
        await queueSyncEvent({
            entity_type: 'SALE',
            entity_id: saleId,
            action_type: 'CREATE',
            payload: {
                saleId,
                customer_id,
                subtotal: subtotal.toString(),
                discount: discountVal.toString(),
                total: finalTotal.toString(),
                paid_amount: finalPaidAmount.toString(),
                debt_amount: finalDebtAmount.toString(),
                payment_method: method,
                items: processedItems,
                timestamp: new Date().toISOString()
            }
        });

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
            paid_amount: finalPaidAmount.toString(),
            debt_amount: finalDebtAmount.toString(),
            payment_method: method,
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
            INNER JOIN Sale_Items si ON s.id = si.sale_id
            GROUP BY s.id
            HAVING item_count > 0
            ORDER BY s.created_at DESC, s.id DESC
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
            SELECT si.*, 
                   COALESCE(p.name, 'کاڵا') as product_name, 
                   p.barcode,
                   p.unit,
                   si.price_at_sale as price_per_unit,
                   (si.quantity * si.price_at_sale) as total_price
            FROM Sale_Items si
            LEFT JOIN Products p ON si.product_id = p.id
            WHERE si.sale_id = ?
        `, [id]);

        // Fetch FIFO batch breakdown for each item
        const [batchAllocations] = await db.query(`
            SELECT sib.*, pb.batch_number, pb.created_at as batch_date
            FROM Sale_Item_Batches sib
            LEFT JOIN Product_Batches pb ON sib.batch_id = pb.id
            WHERE sib.sale_id = ?
        `, [id]);

        const itemsWithBatches = items.map(item => ({
            ...item,
            batches: batchAllocations.filter(b => b.sale_item_id === item.id)
        }));

        res.json({ status: 'SUCCESS', data: { ...sale[0], items: itemsWithBatches } });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};
