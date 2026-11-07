const db = require('../db');

exports.getAllSuppliers = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT s.id, s.name, s.phone,
                   COALESCE(SUM(pi.paid_amount), s.total_paid) as total_paid,
                   COALESCE(SUM(pi.remaining_amount), s.total_remaining) as total_remaining,
                   COUNT(pi.id) as total_invoices,
                   COALESCE(SUM(pi.total_amount), (s.total_paid + s.total_remaining)) as total_purchases
            FROM Suppliers s
            LEFT JOIN Purchase_Invoices pi ON s.id = pi.supplier_id
            GROUP BY s.id
            ORDER BY total_remaining DESC, s.id DESC
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
        
        let totalPaid = Number(supplier[0].total_paid) || 0;
        let totalRemaining = Number(supplier[0].total_remaining) || 0;

        if (invoices.length > 0) {
            totalPaid = invoices.reduce((sum, inv) => sum + (Number(inv.paid_amount) || 0), 0);
            totalRemaining = invoices.reduce((sum, inv) => sum + (Number(inv.remaining_amount) || 0), 0);
        }

        res.json({ 
            status: 'SUCCESS', 
            data: { 
                ...supplier[0], 
                total_paid: totalPaid,
                total_remaining: totalRemaining,
                invoices 
            } 
        });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.paySupplierDebt = async (req, res) => {
    const { id } = req.params;
    const { amount, invoice_id } = req.body;
    const payAmount = Math.max(0, Math.round(Number(amount) || 0));

    if (payAmount <= 0) {
        return res.status(400).json({ status: 'ERROR', message: 'بڕی پارەی دراو نادروستە' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [suppliers] = await connection.query('SELECT * FROM Suppliers WHERE id = ? FOR UPDATE', [id]);
        if (suppliers.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ status: 'ERROR', message: 'کۆمپانیا نەدۆزرایەوە' });
        }
        const supplier = suppliers[0];

        // 1. Fetch unpaid/partially paid purchase invoices for this supplier
        let querySql = 'SELECT * FROM Purchase_Invoices WHERE supplier_id = ? AND remaining_amount > 0';
        const queryParams = [id];

        if (invoice_id) {
            querySql += ' ORDER BY (id = ?) DESC, created_at ASC, id ASC FOR UPDATE';
            queryParams.push(invoice_id);
        } else {
            querySql += ' ORDER BY created_at ASC, id ASC FOR UPDATE';
        }

        const [unpaidInvoices] = await connection.query(querySql, queryParams);

        let remainingToPay = payAmount;

        // 2. Allocate payment to invoices (FIFO or prioritised invoice)
        for (const inv of unpaidInvoices) {
            if (remainingToPay <= 0) break;
            const invRem = Number(inv.remaining_amount) || 0;
            const toDeduct = Math.min(invRem, remainingToPay);
            const newRem = Math.max(0, invRem - toDeduct);
            const newPaid = (Number(inv.paid_amount) || 0) + toDeduct;
            const newPaymentMethod = newRem === 0 ? 'CASH' : 'PARTIAL';

            await connection.query(
                'UPDATE Purchase_Invoices SET paid_amount = ?, remaining_amount = ?, payment_method = ? WHERE id = ?',
                [newPaid, newRem, newPaymentMethod, inv.id]
            );

            remainingToPay -= toDeduct;
        }

        // 3. Recalculate Supplier's total_paid and total_remaining from all invoices
        const [invTotals] = await connection.query(`
            SELECT COALESCE(SUM(paid_amount), 0) as calc_paid,
                   COALESCE(SUM(remaining_amount), 0) as calc_remaining
            FROM Purchase_Invoices
            WHERE supplier_id = ?
        `, [id]);

        let finalTotalPaid = Number(invTotals[0].calc_paid);
        let finalTotalRemaining = Number(invTotals[0].calc_remaining);

        // If there were no invoices or remaining payment exceeded invoices
        if (unpaidInvoices.length === 0) {
            const currentRem = Number(supplier.total_remaining) || 0;
            const actualDeduction = Math.min(currentRem, payAmount);
            finalTotalPaid = (Number(supplier.total_paid) || 0) + payAmount;
            finalTotalRemaining = Math.max(0, currentRem - actualDeduction);
        }

        await connection.query(
            'UPDATE Suppliers SET total_paid = ?, total_remaining = ? WHERE id = ?',
            [finalTotalPaid, finalTotalRemaining, id]
        );

        // 4. Audit Log
        try {
            await connection.query(`
                INSERT INTO Audit_Logs (user_id, username, user_role, action_type, entity_name, entity_id, details)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                req.user?.id || 1,
                req.user?.username || 'admin',
                req.user?.role || 'admin',
                'SUPPLIER_DEBT_PAYMENT',
                'Suppliers',
                id,
                `دانەوەی قەرزی کۆمپانیای «${supplier.name}» بە بڕی ${payAmount.toLocaleString()} د.ع`
            ]);
        } catch (_) {}

        await connection.commit();
        connection.release();

        res.json({ 
            status: 'SUCCESS', 
            message: 'پارەدان بە سەرکەوتوویی تۆمارکرا',
            data: {
                paid_amount: payAmount,
                new_remaining: finalTotalRemaining,
                new_paid: finalTotalPaid
            }
        });
    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error('Pay Supplier Debt Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};
