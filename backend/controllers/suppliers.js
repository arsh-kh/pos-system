const db = require('../db');

exports.getAllSuppliers = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT s.*, 
                   COUNT(pi.id) as total_invoices,
                   COALESCE(SUM(pi.total_amount), (s.total_paid + s.total_remaining)) as total_purchases
            FROM Suppliers s
            LEFT JOIN Purchase_Invoices pi ON s.id = pi.supplier_id
            GROUP BY s.id
            ORDER BY s.total_remaining DESC, s.id DESC
        `);
        res.json({ status: 'SUCCESS', data: rows });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.addSupplier = async (req, res) => {
    const { name, phone } = req.body;
    try {
        const [result] = await db.query('INSERT INTO Suppliers (name, phone) VALUES (?, ?)', [name, phone]);
        res.status(201).json({ status: 'SUCCESS', data: { id: result.insertId, name, phone, total_paid: 0, total_remaining: 0, total_invoices: 0 } });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.getSupplierProfile = async (req, res) => {
    const { id } = req.params;
    try {
        const [supplier] = await db.query('SELECT * FROM Suppliers WHERE id = ?', [id]);
        if (supplier.length === 0) return res.status(404).json({ status: 'ERROR', message: 'کۆمپانیا نەدۆزرایەوە' });
        
        const [invoices] = await db.query('SELECT * FROM Purchase_Invoices WHERE supplier_id = ? ORDER BY created_at DESC', [id]);
        
        res.json({ status: 'SUCCESS', data: { ...supplier[0], invoices } });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.paySupplierDebt = async (req, res) => {
    const { id } = req.params;
    const { amount } = req.body;
    const payAmount = Math.max(0, Math.round(Number(amount) || 0));

    if (payAmount <= 0) {
        return res.status(400).json({ status: 'ERROR', message: 'بڕی پارەی دراو نادروستە' });
    }

    try {
        const [supplier] = await db.query('SELECT * FROM Suppliers WHERE id = ?', [id]);
        if (supplier.length === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'کۆمپانیا نەدۆزرایەوە' });
        }

        const currentRemaining = Number(supplier[0].total_remaining) || 0;
        const actualDeduction = Math.min(currentRemaining, payAmount);

        await db.query(`
            UPDATE Suppliers 
            SET total_paid = total_paid + ?, 
                total_remaining = GREATEST(0, total_remaining - ?)
            WHERE id = ?
        `, [payAmount, actualDeduction, id]);

        res.json({ 
            status: 'SUCCESS', 
            message: 'پارەدان بە سەرکەوتوویی تۆمارکرا',
            data: {
                paid_amount: payAmount,
                new_remaining: Math.max(0, currentRemaining - actualDeduction)
            }
        });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};
