const db = require('../db');

exports.getAllCategories = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM Categories');
        res.json({ status: 'SUCCESS', data: rows });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.addCategory = async (req, res) => {
    const { name } = req.body;
    try {
        const [result] = await db.query('INSERT INTO Categories (name) VALUES (?)', [name]);
        res.status(201).json({ status: 'SUCCESS', data: { id: result.insertId, name } });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};
