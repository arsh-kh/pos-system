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

        // Fetch today's debt repayments summary for instant display (قەرزی هاتۆتەوەی ئەمڕۆ)
        const [todayRepaymentsRows] = await db.query(`
            SELECT COALESCE(SUM(amount), 0) AS today_total, COUNT(id) AS today_count
            FROM Customer_Debts
            WHERE transaction_type = 'PAY' AND DATE(created_at) = CURRENT_DATE()
        `);
        const todayRepayments = {
            today_total: Number(todayRepaymentsRows[0]?.today_total) || 0,
            today_count: Number(todayRepaymentsRows[0]?.today_count) || 0
        };

        res.json({ status: 'SUCCESS', data: rows, today_repayments: todayRepayments });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.getDebtRepayments = async (req, res) => {
    try {
        const { range = 'today', startDate, endDate } = req.query;
        let whereClause = "cd.transaction_type = 'PAY'";
        let params = [];

        if (range === 'today') {
            whereClause += " AND DATE(cd.created_at) = CURRENT_DATE()";
        } else if (range === 'week') {
            whereClause += " AND cd.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
        } else if (range === 'month') {
            whereClause += " AND MONTH(cd.created_at) = MONTH(CURRENT_DATE()) AND YEAR(cd.created_at) = YEAR(CURRENT_DATE())";
        } else if (range === 'custom' && startDate && endDate) {
            whereClause += " AND cd.created_at BETWEEN ? AND ?";
            params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
        }

        const [rows] = await db.query(`
            SELECT 
                cd.id,
                cd.customer_id,
                c.name AS customer_name,
                c.phone AS customer_phone,
                cd.amount,
                cd.note,
                cd.created_at
            FROM Customer_Debts cd
            JOIN Customers c ON cd.customer_id = c.id
            WHERE ${whereClause}
            ORDER BY cd.created_at DESC
        `, params);

        const totalAmount = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

        res.json({
            status: 'SUCCESS',
            data: rows,
            summary: {
                total_amount: totalAmount,
                count: rows.length
            }
        });
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
                   (CASE 
                       WHEN cd.transaction_type = 'PAY' AND (cd.note LIKE '%گەڕاندنەوە%' OR cd.note LIKE '%گەڕاوە%' OR EXISTS (SELECT 1 FROM Returns r WHERE r.debt_transaction_id = cd.id)) THEN 1 
                       ELSE 0 
                   END) AS is_return,
                   (
                       CASE 
                           WHEN cd.transaction_type = 'ADD' THEN
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
                               )
                           ELSE NULL
                       END
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
