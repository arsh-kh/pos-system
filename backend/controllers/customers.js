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
    const { name, phone, notes } = req.body;
    try {
        const [result] = await db.query('INSERT INTO Customers (name, phone, notes) VALUES (?, ?, ?)', [name, phone, notes || null]);
        res.status(201).json({ status: 'SUCCESS', data: { id: result.insertId, name, phone, notes: notes || null, total_debt: 0 } });
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

        // Get debt history with itemized sale products details
        const [history] = await db.query(`
            SELECT cd.*,
                   s.id AS invoice_id,
                   (
                       SELECT GROUP_CONCAT(
                           CONCAT(
                               p.name, 
                               ' (', 
                               TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM FORMAT(si.quantity, 2))),
                               ' ', 
                               CASE WHEN p.is_weighted = 1 OR p.unit = 'کگم' THEN 'کگم' ELSE 'دانە' END,
                               ' × ', 
                               FORMAT(si.price_at_sale, 0),
                               ')'
                           ) SEPARATOR ' ، '
                       )
                       FROM Sale_Items si
                       JOIN Products p ON si.product_id = p.id
                       WHERE si.sale_id = cd.sale_id
                   ) AS sale_items_summary
            FROM Customer_Debts cd
            LEFT JOIN Sales s ON cd.sale_id = s.id
            WHERE cd.customer_id = ? 
            ORDER BY cd.created_at DESC, cd.id DESC
        `, [id]);

        res.json({ status: 'SUCCESS', data: { ...customer[0], history } });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.addDebtTransaction = async (req, res) => {
    const { id } = req.params;
    const { amount, transaction_type, note } = req.body; // 'ADD' or 'PAY'
    try {
        const cleanType = (transaction_type || '').toUpperCase().trim();
        if (cleanType !== 'ADD' && cleanType !== 'PAY') {
            return res.status(400).json({ status: 'ERROR', message: 'جۆری مامەڵە دەبێت ADD یان PAY بێت' });
        }

        const parsedAmount = Math.round(Number(amount));
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ status: 'ERROR', message: 'بڕی پارە دەبێت ژمارەیەکی دروست و زیاتر لە سفر بێت' });
        }

        const [cust] = await db.query('SELECT id FROM Customers WHERE id = ?', [id]);
        if (cust.length === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'کڕیارەکە نەدۆزرایەوە' });
        }

        const defaultNote = cleanType === 'PAY' ? 'دانەوەی قەرز بە دەستی' : 'زیادکردنی قەرز بە دەستی';
        const [result] = await db.query(
            'INSERT INTO Customer_Debts (customer_id, amount, transaction_type, note) VALUES (?, ?, ?, ?)',
            [id, parsedAmount, cleanType, note || defaultNote]
        );
        res.status(201).json({ status: 'SUCCESS', message: 'Transaction recorded' });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};
