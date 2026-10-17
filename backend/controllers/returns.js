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
        // If sale was DEBT, recommended is DEBT
        // If sale was SPLIT and customer currently has debt, recommend DEBT (to clear debt first), else CASH
        // If sale was CASH, recommend CASH
        let recommendedRefundMethod = 'CASH';
        if (sale.payment_method === 'DEBT') {
            recommendedRefundMethod = 'DEBT';
        } else if (sale.payment_method === 'SPLIT') {
            recommendedRefundMethod = customerTotalDebt > 0 ? 'DEBT' : 'CASH';
        }

        const [items] = await db.query(`
            SELECT si.*, 
                   COALESCE(si.custom_name, p.name) as product_name, 
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

        const formattedItems = items.map(item => {
            const purchasedQty = Number(item.quantity) || 0;
            const alreadyReturned = Number(item.already_returned) || 0;
            const returnableQty = Math.max(0, purchasedQty - alreadyReturned);

            return {
                ...item,
                quantity: purchasedQty,
                already_returned: alreadyReturned,
                returnable_qty: returnableQty
            };
        });

        res.json({
            status: 'SUCCESS',
            data: {
                ...sale,
                customer_total_debt: customerTotalDebt,
                recommended_refund_method: recommendedRefundMethod,
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
            'SELECT si.*, COALESCE(si.custom_name, p.name) as product_name FROM Sale_Items si LEFT JOIN Products p ON si.product_id = p.id WHERE si.sale_id = ? AND si.product_id = ?',
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

        const priceAtSale = Number(saleItem.price_at_sale) || 0;
        const refundedAmount = Math.round(priceAtSale * returnQty);

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
