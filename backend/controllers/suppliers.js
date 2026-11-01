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
    const trimmedName = (name || '').trim();
    if (!trimmedName) {
        return res.status(400).json({ status: 'ERROR', message: 'ناوی کۆمپانیا بەتاڵە' });
    }
    try {
        const [result] = await db.query('INSERT INTO Suppliers (name, phone) VALUES (?, ?)', [trimmedName, (phone || '').trim()]);
        res.status(201).json({ status: 'SUCCESS', data: { id: result.insertId, name: trimmedName, phone: (phone || '').trim(), total_paid: 0, total_remaining: 0, total_invoices: 0 } });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.updateSupplier = async (req, res) => {
    const { id } = req.params;
    const { name, phone } = req.body;
    const trimmedName = (name || '').trim();
    if (!trimmedName) {
        return res.status(400).json({ status: 'ERROR', message: 'ناوی کۆمپانیا بەتاڵە' });
    }

    try {
        const [existing] = await db.query('SELECT * FROM Suppliers WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'کۆمپانیا نەدۆزرایەوە' });
        }

        await db.query('UPDATE Suppliers SET name = ?, phone = ? WHERE id = ?', [trimmedName, (phone || '').trim(), id]);

        // Audit Log
        try {
            await db.query(`
                INSERT INTO Audit_Logs (user_id, username, user_role, action_type, entity_name, entity_id, details)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                req.user?.id || 1,
                req.user?.username || 'admin',
                req.user?.role || 'admin',
                'SUPPLIER_UPDATED',
                'Suppliers',
                id,
                `دەستکاریکردنی زانیارییەکانی کۆمپانیا: ${trimmedName}`
            ]);
        } catch (_) {}

        res.json({
            status: 'SUCCESS',
            message: 'زانیارییەکانی کۆمپانیا بە سەرکەوتوویی نوێکرانەوە',
            data: { id: Number(id), name: trimmedName, phone: (phone || '').trim() }
        });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.deleteSupplier = async (req, res) => {
    const { id } = req.params;
    try {
        const [existing] = await db.query('SELECT * FROM Suppliers WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'کۆمپانیا نەدۆزرایەوە' });
        }

        const supplier = existing[0];
        const remainingDebt = Number(supplier.total_remaining) || 0;
        if (remainingDebt > 0) {
            return res.status(400).json({
                status: 'ERROR',
                message: `ناتوانرێت ئەم کۆمپانیایە بسڕدرێتەوە چونکە بڕی ${remainingDebt.toLocaleString()} د.ع قەرزی ماوە. تکایە سەرەتا قەرزەکەی پاکتاو بکە.`
            });
        }

        // Safely unlink any purchase invoices so historical batches, stock, and invoices are 100% preserved
        await db.query('UPDATE Purchase_Invoices SET supplier_id = NULL WHERE supplier_id = ?', [id]);
        try {
            await db.query('UPDATE Purchase_Returns SET supplier_id = NULL WHERE supplier_id = ?', [id]);
        } catch (_) {}

        await db.query('DELETE FROM Suppliers WHERE id = ?', [id]);

        // Audit Log
        try {
            await db.query(`
                INSERT INTO Audit_Logs (user_id, username, user_role, action_type, entity_name, entity_id, details)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                req.user?.id || 1,
                req.user?.username || 'admin',
                req.user?.role || 'admin',
                'SUPPLIER_DELETED',
                'Suppliers',
                id,
                `سڕینەوەی کۆمپانیای: ${supplier.name}`
            ]);
        } catch (_) {}

        res.json({
            status: 'SUCCESS',
            message: `کۆمپانیای «${supplier.name}» بە سەرکەوتوویی سڕایەوە و پسووڵەکانی بە پارێزراوی مانەوە.`
        });
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
