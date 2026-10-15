const db = require('../db');

const safeBigInt = (val) => {
    const num = Math.round(Number(val) || 0);
    return BigInt(num);
};

exports.createPurchaseReturn = async (req, res) => {
    const { supplier_id, product_id, quantity, cost_price, refund_type, reason } = req.body;

    const returnQty = Math.max(0.001, parseFloat(quantity) || 0);
    const returnCost = Math.max(0, Math.round(Number(cost_price) || 0));

    if (!product_id || returnQty <= 0 || returnCost <= 0) {
        return res.status(400).json({ status: 'ERROR', message: 'تکایە کاڵا، بڕ و نرخی گەڕاندنەوە دیاری بکە' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Verify product
        const [prodRows] = await connection.query('SELECT id, name, stock FROM Products WHERE id = ? FOR UPDATE', [product_id]);
        if (prodRows.length === 0) {
            throw new Error('کاڵاکە نەدۆزرایەوە');
        }

        const totalRefund = Math.round(returnCost * returnQty);

        // 2. Insert into Purchase_Returns
        const [result] = await connection.query(
            'INSERT INTO Purchase_Returns (supplier_id, product_id, quantity, cost_price, total_refund, refund_type, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                supplier_id || null, 
                product_id, 
                returnQty, 
                returnCost, 
                totalRefund, 
                refund_type || 'DEBT_DEDUCT', 
                reason || null
            ]
        );

        // 3. Deduct stock from Products
        await connection.query('UPDATE Products SET stock = stock - ? WHERE id = ?', [returnQty, product_id]);

        // 4. If DEBT_DEDUCT and supplier_id is present, deduct from supplier remaining debt
        if (supplier_id && refund_type === 'DEBT_DEDUCT') {
            await connection.query(
                'UPDATE Suppliers SET total_remaining = GREATEST(0, total_remaining - ?) WHERE id = ?',
                [safeBigInt(totalRefund).toString(), supplier_id]
            );
        }

        await connection.commit();
        res.status(201).json({ 
            status: 'SUCCESS', 
            message: 'کاڵاکە بە سەرکەوتوویی بۆ کۆمپانیا گەڕێندرایەوە',
            returnId: result.insertId,
            totalRefund
        });

    } catch (error) {
        await connection.rollback();
        console.error('Purchase Return Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    } finally {
        connection.release();
    }
};

exports.getAllPurchaseReturns = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT pr.*, 
                   COALESCE(s.name, 'کڕینی لۆکاڵی / بێ کۆمپانیا') as supplier_name,
                   s.phone as supplier_phone,
                   p.name as product_name,
                   p.barcode as product_barcode
            FROM Purchase_Returns pr
            LEFT JOIN Suppliers s ON pr.supplier_id = s.id
            JOIN Products p ON pr.product_id = p.id
            ORDER BY pr.created_at DESC
        `);
        res.json({ status: 'SUCCESS', data: rows });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};
