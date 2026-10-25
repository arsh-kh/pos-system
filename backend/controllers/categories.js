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
