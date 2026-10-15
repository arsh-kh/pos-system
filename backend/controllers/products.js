const db = require('../db');

exports.getAllProducts = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.*, c.name as category_name 
            FROM Products p 
            LEFT JOIN Categories c ON p.category_id = c.id
            ORDER BY p.id DESC
        `);
        res.json({ status: 'SUCCESS', data: rows });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.addProduct = async (req, res) => {
    const { name, barcode, cost_price, selling_price, usd_price, stock, category_id, wholesale_price, expiry_date, low_stock_threshold } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO Products (name, barcode, cost_price, selling_price, usd_price, stock, category_id, wholesale_price, expiry_date, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                name, 
                barcode, 
                cost_price || 0, 
                selling_price, 
                usd_price || 0, 
                stock || 0, 
                category_id || null,
                wholesale_price || 0,
                expiry_date || null,
                low_stock_threshold !== undefined && low_stock_threshold !== '' ? parseInt(low_stock_threshold) : 5
            ]
        );
        res.status(201).json({ status: 'SUCCESS', message: 'Product added successfully', id: result.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ status: 'ERROR', message: 'Barcode already exists' });
        }
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    const { id } = req.params;
    const { name, barcode, cost_price, selling_price, usd_price, stock, category_id, wholesale_price, expiry_date, low_stock_threshold } = req.body;
    try {
        await db.query(
            'UPDATE Products SET name=?, barcode=?, cost_price=?, selling_price=?, usd_price=?, stock=?, category_id=?, wholesale_price=?, expiry_date=?, low_stock_threshold=? WHERE id=?',
            [
                name, 
                barcode, 
                cost_price || 0, 
                selling_price, 
                usd_price || 0, 
                stock || 0, 
                category_id || null,
                wholesale_price || 0,
                expiry_date || null,
                low_stock_threshold !== undefined && low_stock_threshold !== '' ? parseInt(low_stock_threshold) : 5,
                id
            ]
        );
        res.json({ status: 'SUCCESS', message: 'Product updated successfully' });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM Products WHERE id = ?', [id]);
        res.json({ status: 'SUCCESS', message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};
