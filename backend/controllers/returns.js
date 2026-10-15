const db = require('../db');
const { logAuditAction } = require('../middleware/auditLogger');

// Lookup a sale and calculate returnable quantities for each item
exports.getSaleForReturn = async (req, res) => {
    try {
        const { id } = req.params;
        const [sales] = await db.query(`
            SELECT s.*, 
                   COALESCE(c.name, 'کڕیاری گشتی') as customer_name,
                   c.phone as customer_phone
            FROM Sales s
            LEFT JOIN Customers c ON s.customer_id = c.id
            WHERE s.id = ?
        `, [id]);

        if (sales.length === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'پسووڵەی داواکراو نەدۆزرایەوە' });
        }

        const sale = sales[0];

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
                items: formattedItems
            }
        });
    } catch (error) {
        console.error('Get Sale For Return Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.processReturn = async (req, res) => {
    const { sale_id, product_id, quantity, reason } = req.body;
    
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Verify sale and get price_at_sale
        const [saleItems] = await connection.query(
            'SELECT * FROM Sale_Items WHERE sale_id = ? AND product_id = ?',
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

        // 2. Insert into Returns
        await connection.query(
            'INSERT INTO Returns (sale_id, product_id, quantity, refunded_amount, reason) VALUES (?, ?, ?, ?, ?)',
            [sale_id, product_id, returnQty, refundedAmount, reason || 'گەڕاندنەوە لە کڕیار']
        );

        // 3. Update stock back
        await connection.query(
            'UPDATE Products SET stock = stock + ? WHERE id = ?',
            [returnQty, product_id]
        );

        await connection.commit();

        // Audit log refund return
        await logAuditAction({
            req,
            action_type: 'REFUND_RETURN',
            entity_name: 'Returns',
            entity_id: sale_id,
            new_value: { sale_id, product_id, return_qty: returnQty, refunded_amount: refundedAmount, reason },
            details: `گەڕاندنەوەی ${returnQty} دانە لە کاڵا بۆ پسووڵەی #${sale_id} بە بڕی پارەی ${refundedAmount.toLocaleString()} دینار (هۆکار: ${reason || 'دیارینەکراو'})`
        });
        res.json({ 
            status: 'SUCCESS', 
            message: 'کاڵا بە سەرکەوتوویی گەڕێنرایەوە بۆ کۆگا و بڕی پارەی پسووڵە نوێکرایەوە', 
            refunded_amount: refundedAmount 
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
                   COALESCE(c.name, 'کڕیاری گشتی') as customer_name
            FROM Returns r
            LEFT JOIN Products p ON r.product_id = p.id
            LEFT JOIN Sales s ON r.sale_id = s.id
            LEFT JOIN Customers c ON s.customer_id = c.id
            ORDER BY r.created_at DESC
        `);
        res.json({ status: 'SUCCESS', data: rows });
    } catch (error) {
        console.error('Get Returns History Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};
