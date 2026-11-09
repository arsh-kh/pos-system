const db = require('../db');

exports.getAllCategories = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM Categories ORDER BY name ASC');
        res.json({ status: 'SUCCESS', data: rows });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.addCategory = async (req, res) => {
    const { name } = req.body;
    try {
        const trimmed = (name || '').trim();
        if (!trimmed) {
            return res.status(400).json({ status: 'ERROR', message: 'ناوی کەتەگۆری بەتاڵە' });
        }
        const [existing] = await db.query('SELECT * FROM Categories WHERE name = ?', [trimmed]);
        if (existing.length > 0) {
            return res.json({ status: 'SUCCESS', data: existing[0] });
        }
        const [result] = await db.query('INSERT INTO Categories (name) VALUES (?)', [trimmed]);
        res.status(201).json({ status: 'SUCCESS', data: { id: result.insertId, name: trimmed } });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.deleteCategory = async (req, res) => {
    const { id } = req.params;
    try {
        if (!id) {
            return res.status(400).json({ status: 'ERROR', message: 'ناسنامەی جۆر دیاری نەکراوە' });
        }
        const [existing] = await db.query('SELECT * FROM Categories WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'ئەم جۆرە نەدۆزرایەوە' });
        }
        // Detach products safely
        await db.query('UPDATE products SET category_id = NULL WHERE category_id = ?', [id]);
        // Delete category
        await db.query('DELETE FROM Categories WHERE id = ?', [id]);
        res.json({ status: 'SUCCESS', message: 'جۆر بە سەرکەوتوویی سڕایەوە', id: Number(id) });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};
