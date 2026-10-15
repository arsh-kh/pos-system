const db = require('../db');

exports.getAllCustomers = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT c.*, 
                   COALESCE(SUM(CASE WHEN cd.transaction_type = 'ADD' THEN cd.amount ELSE 0 END) - 
                            SUM(CASE WHEN cd.transaction_type = 'PAY' THEN cd.amount ELSE 0 END), 0) AS total_debt
            FROM Customers c
            LEFT JOIN Customer_Debts cd ON c.id = cd.customer_id
            GROUP BY c.id
            ORDER BY total_debt DESC
        `);
        res.json({ status: 'SUCCESS', data: rows });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.addCustomer = async (req, res) => {
    const { name, phone } = req.body;
    try {
        const [result] = await db.query('INSERT INTO Customers (name, phone) VALUES (?, ?)', [name, phone]);
        res.status(201).json({ status: 'SUCCESS', data: { id: result.insertId, name, phone, total_debt: 0 } });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.getCustomerProfile = async (req, res) => {
    const { id } = req.params;
    try {
        // Get customer details
        const [customer] = await db.query(`
            SELECT c.*, 
                   COALESCE(SUM(CASE WHEN cd.transaction_type = 'ADD' THEN cd.amount ELSE 0 END) - 
                            SUM(CASE WHEN cd.transaction_type = 'PAY' THEN cd.amount ELSE 0 END), 0) AS total_debt
            FROM Customers c
            LEFT JOIN Customer_Debts cd ON c.id = cd.customer_id
            WHERE c.id = ?
            GROUP BY c.id
        `, [id]);

        if (customer.length === 0) return res.status(404).json({ status: 'ERROR', message: 'Customer not found' });

        // Get debt history
        const [history] = await db.query(`
            SELECT * FROM Customer_Debts 
            WHERE customer_id = ? 
            ORDER BY created_at DESC
        `, [id]);

        res.json({ status: 'SUCCESS', data: { ...customer[0], history } });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.addDebtTransaction = async (req, res) => {
    const { id } = req.params;
    const { amount, transaction_type } = req.body; // 'ADD' or 'PAY'
    try {
        const [result] = await db.query(
            'INSERT INTO Customer_Debts (customer_id, amount, transaction_type) VALUES (?, ?, ?)',
            [id, amount, transaction_type]
        );
        res.status(201).json({ status: 'SUCCESS', message: 'Transaction recorded' });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};
