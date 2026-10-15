const db = require('../db');

// Ensure standard 11 departments and columns exist
const ensureNeedsSchema = async () => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS Needs_Categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE
            ) ENGINE=InnoDB;
        `);

        const defaultCats = [
            'خواردەمەنی',
            'شیرەمەنی',
            'شیرینی و بسکیت',
            'پاککەرەوە',
            'خواردنەوەکان',
            'سەوزە و میوە',
            'بەهارات و وشکە',
            'پلاستیک و کەلوپەل',
            'بەستوو',
            'نان و کێک',
            'گشتی'
        ];

        for (const cat of defaultCats) {
            await db.query('INSERT IGNORE INTO Needs_Categories (name) VALUES (?)', [cat]);
        }

        // Add additional columns if missing
        try { await db.query("ALTER TABLE Needs ADD COLUMN is_customer_request BOOLEAN DEFAULT FALSE"); } catch (_) {}
        try { await db.query("ALTER TABLE Needs ADD COLUMN priority VARCHAR(20) DEFAULT 'NORMAL'"); } catch (_) {}
        try { await db.query("ALTER TABLE Needs ADD COLUMN notes VARCHAR(255) DEFAULT ''"); } catch (_) {}
    } catch (err) {
        console.error('Failed to ensure Needs schema:', err.message);
    }
};

ensureNeedsSchema();

exports.getNeeds = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT n.*, COALESCE(c.name, 'گشتی') as category_name 
            FROM Needs n
            LEFT JOIN Needs_Categories c ON n.category_id = c.id
            ORDER BY n.is_fulfilled ASC, 
                     CASE 
                       WHEN n.priority = 'HIGH' THEN 1 
                       WHEN n.priority = 'MEDIUM' THEN 2 
                       ELSE 3 
                     END,
                     n.id DESC
        `);
        res.json({ status: 'SUCCESS', data: rows });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.getNeedsCategories = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM Needs_Categories ORDER BY id ASC');
        res.json({ status: 'SUCCESS', data: rows });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.addNeedsCategory = async (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ status: 'ERROR', message: 'Category name is required' });
    }
    try {
        const [result] = await db.query('INSERT INTO Needs_Categories (name) VALUES (?)', [name.trim()]);
        res.status(201).json({ status: 'SUCCESS', data: { id: result.insertId, name: name.trim() } });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ status: 'ERROR', message: 'ئەم بەشە پێشتر بوونی هەیە' });
        }
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.addNeed = async (req, res) => {
    const { category_id, item_name, is_customer_request, priority, notes } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO Needs (category_id, item_name, is_customer_request, priority, notes) VALUES (?, ?, ?, ?, ?)',
            [
                category_id || 1, 
                item_name, 
                is_customer_request ? 1 : 0, 
                priority || 'NORMAL', 
                notes || ''
            ]
        );
        res.status(201).json({ 
            status: 'SUCCESS', 
            data: { 
                id: result.insertId, 
                category_id, 
                item_name, 
                is_customer_request: !!is_customer_request, 
                priority: priority || 'NORMAL',
                notes: notes || ''
            } 
        });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.markFulfilled = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('UPDATE Needs SET is_fulfilled = NOT is_fulfilled WHERE id = ?', [id]);
        res.json({ status: 'SUCCESS', message: 'Toggled fulfillment' });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.deleteNeed = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM Needs WHERE id = ?', [id]);
        res.json({ status: 'SUCCESS', message: 'Deleted need' });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};
