const db = require('../db');
const { logAuditAction } = require('../middleware/auditLogger');
const { queueSyncEvent } = require('./sync');

// Lookup a sale and calculate returnable quantities for each item
exports.getSaleForReturn = async (req, res) => {
    try {
        const { id } = req.params;
        const [sales] = await db.query(`
            SELECT s.*, 
                   COALESCE(c.name, 'کڕیاری گشتی') as customer_name,
                   c.phone as customer_phone,
                   COALESCE((
                       SELECT SUM(CASE WHEN cd.transaction_type = 'ADD' THEN cd.amount ELSE -cd.amount END)
                       FROM Customer_Debts cd 
                       WHERE cd.customer_id = s.customer_id
                   ), 0) as customer_total_debt
            FROM Sales s
            LEFT JOIN Customers c ON s.customer_id = c.id
            WHERE s.id = ?
        `, [id]);

        if (sales.length === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'پسووڵەی داواکراو نەدۆزرایەوە' });
        }

        const sale = sales[0];
        const customerTotalDebt = Number(sale.customer_total_debt || 0);

        // Smart recommendation:
        // If sale had DEBT and customer currently has debt, recommend DEBT (to clear debt first), else CASH
        // If sale was CASH or customer is anonymous, recommend CASH
        let recommendedRefundMethod = 'CASH';
        if (sale.customer_id && (sale.payment_method === 'DEBT' || Number(sale.debt_amount) > 0)) {
            recommendedRefundMethod = customerTotalDebt > 0 ? 'DEBT' : 'CASH';
        } else if (sale.customer_id && sale.payment_method === 'SPLIT') {
            recommendedRefundMethod = customerTotalDebt > 0 ? 'DEBT' : 'CASH';
        }

        // Check total refunds already executed for this sale
        const [alreadyRefundedRows] = await db.query(
            'SELECT COALESCE(SUM(refunded_amount), 0) as already_refunded_total FROM Returns WHERE sale_id = ?',
            [id]
        );
        const alreadyRefundedTotal = Number(alreadyRefundedRows[0].already_refunded_total) || 0;
        const saleTotalAmount = Number(sale.total_amount) || 0;
        const remainingRefundableTotal = Math.max(0, saleTotalAmount - alreadyRefundedTotal);

        const [items] = await db.query(`
            SELECT si.*, 
                   p.name as product_name, 
                   p.barcode,
                   p.unit,
                   COALESCE((
                       SELECT SUM(r.quantity) 
                       FROM Returns r 
                       WHERE r.sale_id = si.sale_id AND r.product_id = si.product_id
                   ), 0) as already_returned
            FROM Sale_Items si
            LEFT JOIN Products p ON si.product_id = p.id
            WHERE si.sale_id = ?
        `, [id]);

        if (items.length === 0) {
            return res.status(400).json({ status: 'ERROR', message: 'ئەم پسووڵەیە هیچ کاڵایەکی تێدا نییە بۆ گەڕاندنەوە' });
        }

        // Calculate sale subtotal and proportional discount ratio
        const calculatedSubtotal = items.reduce(
            (sum, it) => sum + (Number(it.price_at_sale) * Number(it.quantity)),
            0
        );
        const saleSubtotal = Number(sale.subtotal_amount) > 0 ? Number(sale.subtotal_amount) : calculatedSubtotal;
        const discountAmount = Number(sale.discount_amount) || 0;

        let discountRatio = 1;
        if (discountAmount > 0 && saleSubtotal > 0) {
            discountRatio = Math.max(0, Math.min(1, saleTotalAmount / saleSubtotal));
        }

        const formattedItems = items.map(item => {
            const purchasedQty = Number(item.quantity) || 0;
            const alreadyReturned = Number(item.already_returned) || 0;
            const returnableQty = Math.max(0, purchasedQty - alreadyReturned);
            const originalPrice = Number(item.price_at_sale) || 0;
            const effectivePrice = Math.round(originalPrice * discountRatio);

            return {
                ...item,
                quantity: purchasedQty,
                already_returned: alreadyReturned,
                returnable_qty: returnableQty,
                original_price_at_sale: originalPrice,
                effective_unit_price: effectivePrice,
                has_discount: discountRatio < 0.9999,
                discount_ratio: discountRatio
            };
        });

        const isFullyReturned = formattedItems.every(it => it.returnable_qty <= 0);

        res.json({
            status: 'SUCCESS',
            data: {
                ...sale,
                subtotal_amount: saleSubtotal,
                discount_amount: discountAmount,
                already_refunded_total: alreadyRefundedTotal,
                remaining_refundable_total: remainingRefundableTotal,
                customer_total_debt: customerTotalDebt,
                recommended_refund_method: recommendedRefundMethod,
                is_fully_returned: isFullyReturned,
                items: formattedItems
            }
        });
    } catch (error) {
        console.error('Get Sale For Return Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.processReturn = async (req, res) => {
    const { sale_id, product_id, quantity, reason, refund_method } = req.body;
    
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Verify sale and get price_at_sale and payment details
        const [sales] = await connection.query(
            'SELECT s.*, c.name as customer_name FROM Sales s LEFT JOIN Customers c ON s.customer_id = c.id WHERE s.id = ?',
            [sale_id]
        );
        if (sales.length === 0) throw new Error('پسووڵەی فرۆشتن نەدۆزرایەوە');
        const sale = sales[0];

        const [saleItems] = await connection.query(
            'SELECT si.*, p.name as product_name FROM Sale_Items si LEFT JOIN Products p ON si.product_id = p.id WHERE si.sale_id = ? AND si.product_id = ?',
            [sale_id, product_id]
        );

        if (saleItems.length === 0) {
            throw new Error('کاڵای دیاریکراو لەم پسووڵەیەدا نییە');
        }

        const saleItem = saleItems[0];
        const returnQty = Number(quantity);

        if (isNaN(returnQty) || returnQty <= 0) {
            throw new Error('تکایە بڕی گەڕاندنەوەی دروست دیاری بکە');
        }

        // Check already returned quantity
        const [existingReturns] = await connection.query(
            'SELECT COALESCE(SUM(quantity), 0) as already_returned FROM Returns WHERE sale_id = ? AND product_id = ?',
            [sale_id, product_id]
        );
        const alreadyReturned = Number(existingReturns[0].already_returned) || 0;
        const maxReturnable = Number(saleItem.quantity) - alreadyReturned;

        if (returnQty > maxReturnable) {
            throw new Error(`ناتوانی لە بڕی گەڕاوە زیاتر لەوەی ماوە بگەڕێنیتەوە (ماوە: ${maxReturnable})`);
        }

        // Check total refunds already executed for this sale
        const [totalRefundsForSale] = await connection.query(
            'SELECT COALESCE(SUM(refunded_amount), 0) as already_refunded FROM Returns WHERE sale_id = ?',
            [sale_id]
        );
        const alreadyRefundedTotal = Number(totalRefundsForSale[0].already_refunded) || 0;
        const saleTotalAmount = Number(sale.total_amount) || 0;
        const remainingRefundableForSale = Math.max(0, saleTotalAmount - alreadyRefundedTotal);

        // Calculate sale subtotal and proportional discount ratio
        const [allItemsInSale] = await connection.query(
            'SELECT id, quantity, price_at_sale FROM Sale_Items WHERE sale_id = ?',
            [sale_id]
        );
        const calculatedSubtotal = allItemsInSale.reduce(
            (sum, it) => sum + (Number(it.price_at_sale) * Number(it.quantity)),
            0
        );
        const saleSubtotal = Number(sale.subtotal_amount) > 0 ? Number(sale.subtotal_amount) : calculatedSubtotal;
        const discountAmount = Number(sale.discount_amount) || 0;

        let discountRatio = 1;
        if (discountAmount > 0 && saleSubtotal > 0) {
            discountRatio = Math.max(0, Math.min(1, saleTotalAmount / saleSubtotal));
        }

        const priceAtSale = Number(saleItem.price_at_sale) || 0;
        const effectivePriceAtSale = priceAtSale * discountRatio;
        let refundedAmount = Math.round(effectivePriceAtSale * returnQty);

        // Check if this return returns ALL remaining items in the entire sale
        // If so, assign the exact remainingRefundableForSale to prevent any 1-IQD integer rounding loss
        const [remainingItemsQuery] = await connection.query(`
            SELECT 
                si.id,
                si.quantity - COALESCE((
                    SELECT SUM(r.quantity) 
                    FROM Returns r 
                    WHERE r.sale_id = si.sale_id AND r.product_id = si.product_id
                ), 0) as remaining_qty
            FROM Sale_Items si
            WHERE si.sale_id = ?
        `, [sale_id]);

        let totalRemainingQtyAcrossSale = 0;
        for (const row of remainingItemsQuery) {
            totalRemainingQtyAcrossSale += Number(row.remaining_qty) || 0;
        }

        if (returnQty >= totalRemainingQtyAcrossSale) {
            refundedAmount = remainingRefundableForSale;
        } else if (refundedAmount > remainingRefundableForSale) {
            refundedAmount = remainingRefundableForSale;
        }

        // Account for carton multiplier when restoring stock
        const isBox = saleItem.unit_type === 'BOX';
        const multiplier = isBox ? Math.max(1, parseFloat(saleItem.units_per_box) || 1) : 1;
        const stockToAdd = returnQty * multiplier;

        // Determine refund settlement: CASH vs DEBT
        let finalRefundMethod = (refund_method || '').toUpperCase();
        if (!['CASH', 'DEBT'].includes(finalRefundMethod)) {
            if (sale.payment_method === 'DEBT') {
                finalRefundMethod = 'DEBT';
            } else {
                finalRefundMethod = 'CASH';
            }
        }

        let debtTransactionId = null;

        // If DEBT deduction:
        if (finalRefundMethod === 'DEBT') {
            if (!sale.customer_id) {
                throw new Error('ناتوانرێت لە قەرز کەمبکرێتەوە چونکە ئەم پسووڵەیە کڕیاری دیاریکراوی نییە');
            }
            const debtNote = `گەڕاندنەوەی کاڵا (${saleItem.product_name} x ${returnQty}) بۆ پسووڵەی #${sale_id} - داشکاندن لە قەرز`;
            const [debtRes] = await connection.query(
                'INSERT INTO Customer_Debts (customer_id, sale_id, amount, transaction_type, note) VALUES (?, ?, ?, ?, ?)',
                [sale.customer_id, sale_id, refundedAmount, 'PAY', debtNote]
            );
            debtTransactionId = debtRes.insertId;
        }

        // 2. Insert into Returns
        await connection.query(
            'INSERT INTO Returns (sale_id, product_id, quantity, refunded_amount, refund_method, customer_id, debt_transaction_id, reason, unit_type, units_multiplier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [sale_id, product_id, returnQty, refundedAmount, finalRefundMethod, sale.customer_id || null, debtTransactionId, reason || 'گەڕاندنەوە لە کڕیار', saleItem.unit_type || 'PIECE', multiplier]
        );

        // 3. Update stock back
        await connection.query(
            'UPDATE Products SET stock = stock + ? WHERE id = ?',
            [stockToAdd, product_id]
        );

        // 4. Restore Product_Batches FIFO remaining quantity
        let remStockToRestore = Number(stockToAdd);
        const [saleBatches] = await connection.query(`
            SELECT sib.batch_id, sib.quantity_deducted, pb.remaining_quantity
            FROM Sale_Item_Batches sib
            JOIN Product_Batches pb ON sib.batch_id = pb.id
            WHERE sib.sale_id = ? AND sib.sale_item_id = ?
            ORDER BY sib.id DESC
        `, [sale_id, saleItem.id]);

        if (saleBatches.length > 0) {
            for (const sb of saleBatches) {
                if (remStockToRestore <= 0) break;
                const addBack = Math.min(remStockToRestore, Number(sb.quantity_deducted));
                const newRem = Number(sb.remaining_quantity) + addBack;
                await connection.query(
                    "UPDATE Product_Batches SET remaining_quantity = ?, status = 'ACTIVE' WHERE id = ?",
                    [newRem, sb.batch_id]
                );
                remStockToRestore -= addBack;
            }
        }

        if (remStockToRestore > 0) {
            const [latestBatches] = await connection.query(`
                SELECT id, remaining_quantity FROM Product_Batches 
                WHERE product_id = ? 
                ORDER BY id DESC LIMIT 1
            `, [product_id]);

            if (latestBatches.length > 0) {
                const lb = latestBatches[0];
                const newRem = Number(lb.remaining_quantity) + remStockToRestore;
                await connection.query(
                    "UPDATE Product_Batches SET remaining_quantity = ?, status = 'ACTIVE' WHERE id = ?",
                    [newRem, lb.id]
                );
            }
        }

        await connection.commit();

        // Queue Customer Return for Offline & Online Sync
        await queueSyncEvent({
            entity_type: 'RETURN',
            entity_id: sale_id,
            action_type: 'CREATE',
            payload: {
                sale_id,
                product_id,
                return_qty: returnQty,
                refunded_amount: refundedAmount,
                refund_method: finalRefundMethod,
                customer_id: sale.customer_id || null,
                reason: reason || 'گەڕاندنەوە لە کڕیار',
                timestamp: new Date().toISOString()
            }
        });

        // Audit log
        const auditDetails = finalRefundMethod === 'DEBT'
            ? `گەڕاندنەوەی ${returnQty} لە "${saleItem.product_name}" بۆ پسووڵەی #${sale_id} بە بڕی ${refundedAmount.toLocaleString()} دینار (داشکێندرا لە قەرزی کڕیار: ${sale.customer_name})`
            : `گەڕاندنەوەی ${returnQty} لە "${saleItem.product_name}" بۆ پسووڵەی #${sale_id} بە بڕی ${refundedAmount.toLocaleString()} دینار (نەقد درایەوە لە سندوق)`;

        await logAuditAction({
            req,
            action_type: 'REFUND_RETURN',
            entity_name: 'Returns',
            entity_id: sale_id,
            new_value: { sale_id, product_id, return_qty: returnQty, refunded_amount: refundedAmount, refund_method: finalRefundMethod, reason },
            details: auditDetails
        });

        const successMessage = finalRefundMethod === 'DEBT'
            ? `کاڵا بە سەرکەوتوویی گەڕێنرایەوە بۆ کۆگا و بڕی ${refundedAmount.toLocaleString()} دینار لە قەرزی کڕیار (${sale.customer_name}) کەمکرایەوە`
            : `کاڵا بە سەرکەوتوویی گەڕێنرایەوە بۆ کۆگا و بڕی ${refundedAmount.toLocaleString()} دینار بە نەقد لە سندوق درایەوە`;

        res.json({ 
            status: 'SUCCESS', 
            message: successMessage, 
            refunded_amount: refundedAmount,
            refund_method: finalRefundMethod,
            stock_added: stockToAdd
        });
    } catch (error) {
        await connection.rollback();
        console.error('Return Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    } finally {
        connection.release();
    }
};

exports.getReturnsHistory = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT r.*, 
                   COALESCE(p.name, 'کاڵا') as product_name, 
                   p.barcode,
                   p.unit,
                   s.created_at as sale_date,
                   s.payment_method as sale_payment_method,
                   COALESCE(c.name, 'کڕیاری گشتی') as customer_name
            FROM Returns r
            LEFT JOIN Products p ON r.product_id = p.id
            LEFT JOIN Sales s ON r.sale_id = s.id
            LEFT JOIN Customers c ON COALESCE(r.customer_id, s.customer_id) = c.id
            ORDER BY r.created_at DESC
        `);
        res.json({ status: 'SUCCESS', data: rows });
    } catch (error) {
        console.error('Get Returns History Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.processDirectReturn = async (req, res) => {
    const { product_id, quantity, reason, refund_method, customer_id, unit_type, price, sale_id } = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [products] = await connection.query(
            'SELECT * FROM Products WHERE id = ? FOR UPDATE',
            [product_id]
        );
        if (products.length === 0) {
            throw new Error('کاڵا نەدۆزرایەوە');
        }
        const product = products[0];
        const returnQty = Math.max(0.001, parseFloat(quantity) || 1);

        const isBox = unit_type === 'BOX';
        const multiplier = isBox ? Math.max(1, parseFloat(product.units_per_box) || 1) : 1;
        const stockToAdd = returnQty * multiplier;

        let unitPrice = Number(price);
        if (!unitPrice || isNaN(unitPrice)) {
            unitPrice = isBox && Number(product.wholesale_price) > 0 
                ? Number(product.wholesale_price) 
                : Number(product.selling_price || 0);
        }
        const refundedAmount = Math.round(unitPrice * returnQty);

        let finalRefundMethod = (refund_method || 'CASH').toUpperCase();
        if (!['CASH', 'DEBT'].includes(finalRefundMethod)) {
            finalRefundMethod = 'CASH';
        }

        let debtTransactionId = null;
        let customerName = 'کڕیاری گشتی';
        if (customer_id) {
            const [custRows] = await connection.query('SELECT name FROM Customers WHERE id = ?', [customer_id]);
            if (custRows.length > 0) customerName = custRows[0].name;

            if (finalRefundMethod === 'DEBT') {
                const debtNote = `گەڕاندنەوەی کاڵا (${product.name} x ${returnQty}) - کەمکردنەوە لە قەرز`;
                const [debtRes] = await connection.query(
                    'INSERT INTO Customer_Debts (customer_id, amount, transaction_type, note) VALUES (?, ?, ?, ?)',
                    [customer_id, refundedAmount, 'PAY', debtNote]
                );
                debtTransactionId = debtRes.insertId;
            }
        }

        // Insert into Returns
        const [retResult] = await connection.query(
            'INSERT INTO Returns (sale_id, product_id, quantity, refunded_amount, refund_method, customer_id, debt_transaction_id, reason, unit_type, units_multiplier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [sale_id || null, product_id, returnQty, refundedAmount, finalRefundMethod, customer_id || null, debtTransactionId, reason || 'گەڕاندنەوە لە کاشێر', isBox ? 'BOX' : 'PIECE', multiplier]
        );
        const returnId = retResult.insertId;

        // Restore stock
        await connection.query(
            'UPDATE Products SET stock = stock + ? WHERE id = ?',
            [stockToAdd, product_id]
        );

        // Restore Product_Batches FIFO remaining quantity
        const [latestBatches] = await connection.query(`
            SELECT id, remaining_quantity FROM Product_Batches 
            WHERE product_id = ? 
            ORDER BY id DESC LIMIT 1
        `, [product_id]);

        if (latestBatches.length > 0) {
            const lb = latestBatches[0];
            const newRem = Number(lb.remaining_quantity) + stockToAdd;
            await connection.query(
                "UPDATE Product_Batches SET remaining_quantity = ?, status = 'ACTIVE' WHERE id = ?",
                [newRem, lb.id]
            );
        }

        await connection.commit();

        // Queue Sync Event
        try {
            await queueSyncEvent({
                entity_type: 'RETURN',
                entity_id: returnId,
                action_type: 'CREATE',
                payload: {
                    return_id: returnId,
                    product_id,
                    return_qty: returnQty,
                    refunded_amount: refundedAmount,
                    refund_method: finalRefundMethod,
                    customer_id: customer_id || null,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (syncErr) {
            console.error('Queue sync error (non-fatal):', syncErr);
        }

        // Audit log
        try {
            await logAuditAction({
                req,
                action_type: 'CASHIER_RETURN',
                entity_name: 'Returns',
                entity_id: returnId,
                new_value: { return_id: returnId, product_id, return_qty: returnQty, refunded_amount: refundedAmount },
                details: `گەڕاندنەوەی کاشێر: ${product.name} x ${returnQty} بە بڕی ${refundedAmount.toLocaleString()} دینار (${finalRefundMethod === 'DEBT' ? 'لە قەرز کەمکرایەوە' : 'نەقد درایەوە'})`
            });
        } catch (auditErr) {
            console.error('Audit log error (non-fatal):', auditErr);
        }

        res.json({
            status: 'SUCCESS',
            message: `کاڵای (${product.name}) بە سەرکەوتوویی گەڕێنرایەوە (${returnQty} دانە). بڕی ${refundedAmount.toLocaleString()} د.ع ${finalRefundMethod === 'DEBT' ? 'لە قەرز کەمکرایەوە' : 'بە نەقد درایەوە'}.`,
            data: {
                return_id: returnId,
                product_id: product.id,
                product_name: product.name,
                barcode: product.barcode,
                quantity: returnQty,
                unit: product.unit || 'دانە',
                refunded_amount: refundedAmount,
                refund_method: finalRefundMethod,
                customer_name: customerName,
                created_at: new Date().toISOString()
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('Direct Return Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    } finally {
        connection.release();
    }
};

// Return list of recent sales with returnable items for quick return selection
exports.getRecentSalesForReturn = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT s.id,
                   s.total_amount,
                   s.paid_amount,
                   s.debt_amount,
                   s.payment_method,
                   s.created_at,
                   COALESCE(c.name, 'کڕیاری گشتی') as customer_name,
                   c.phone as customer_phone,
                   COUNT(si.id) as item_count,
                   COALESCE(SUM(si.quantity), 0) as total_items_qty,
                   COALESCE((
                       SELECT SUM(r.quantity) 
                       FROM Returns r 
                       WHERE r.sale_id = s.id
                   ), 0) as total_returned_qty
            FROM Sales s
            LEFT JOIN Customers c ON s.customer_id = c.id
            INNER JOIN Sale_Items si ON s.id = si.sale_id
            GROUP BY s.id
            HAVING (total_items_qty - total_returned_qty) > 0
            ORDER BY s.created_at DESC, s.id DESC
            LIMIT 15
        `);
        res.json({ status: 'SUCCESS', data: rows });
    } catch (error) {
        console.error('Get Recent Sales For Return Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

