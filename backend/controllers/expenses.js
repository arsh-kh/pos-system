const db = require('../db');
const { logAuditAction } = require('../middleware/auditLogger');

exports.createExpense = async (req, res) => {
    const { title, category, amount, expense_date, notes } = req.body;
    const numAmount = Math.max(0, Math.round(Number(amount) || 0));

    if (!title || !category || numAmount <= 0) {
        return res.status(400).json({ status: 'ERROR', message: 'تکایە ناوی خەرجی، جۆر و بڕی پارەی دروست دیاری بکە' });
    }

    try {
        const dateVal = expense_date ? expense_date : new Date().toISOString().split('T')[0];
        const [result] = await db.query(
            'INSERT INTO Expenses (title, description, category, amount, expense_date, notes) VALUES (?, ?, ?, ?, ?, ?)',
            [title.trim(), title.trim(), category.trim(), numAmount, dateVal, notes || null]
        );

        // Audit log expense creation
        await logAuditAction({
            req,
            action_type: 'EXPENSE_CREATE',
            entity_name: 'Expenses',
            entity_id: result.insertId,
            new_value: { title, category, amount: numAmount, expense_date: dateVal, notes },
            details: `تۆمارکردنی خەرجی نوێ: "${title}" بە بڕی ${numAmount.toLocaleString()} دینار بۆ جۆری [${category}]`
        });

        res.status(201).json({
            status: 'SUCCESS',
            message: 'خەرجی بە سەرکەوتوویی تۆمارکرا',
            data: { id: result.insertId, title, category, amount: numAmount, expense_date: dateVal, notes }
        });
    } catch (error) {
        console.error('Create Expense Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.getAllExpenses = async (req, res) => {
    const { category, startDate, endDate } = req.query;
    try {
        let sql = 'SELECT * FROM Expenses WHERE 1=1';
        const params = [];

        if (category && category !== 'ALL') {
            sql += ' AND category = ?';
            params.push(category);
        }

        if (startDate) {
            sql += ' AND expense_date >= ?';
            params.push(startDate);
        }

        if (endDate) {
            sql += ' AND expense_date <= ?';
            params.push(endDate);
        }

        sql += ' ORDER BY expense_date DESC, id DESC';

        const [rows] = await db.query(sql, params);
        res.json({ status: 'SUCCESS', data: rows });
    } catch (error) {
        console.error('Get All Expenses Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.getExpenseSummary = async (req, res) => {
    try {
        // 1. This Month Total Expenses
        const [monthTotalRows] = await db.query(`
            SELECT COALESCE(SUM(amount), 0) as month_expenses, COUNT(id) as month_count
            FROM Expenses
            WHERE MONTH(expense_date) = MONTH(CURRENT_DATE()) AND YEAR(expense_date) = YEAR(CURRENT_DATE())
        `);

        // 2. Today's Total Expenses
        const [todayTotalRows] = await db.query(`
            SELECT COALESCE(SUM(amount), 0) as today_expenses, COUNT(id) as today_count
            FROM Expenses
            WHERE expense_date = CURRENT_DATE()
        `);

        // 3. Category Breakdown (This Month)
        const [catBreakdown] = await db.query(`
            SELECT category, COALESCE(SUM(amount), 0) as total_amount, COUNT(id) as count
            FROM Expenses
            WHERE MONTH(expense_date) = MONTH(CURRENT_DATE()) AND YEAR(expense_date) = YEAR(CURRENT_DATE())
            GROUP BY category
            ORDER BY total_amount DESC
        `);

        // 4. Lifetime Total
        const [lifetimeRows] = await db.query(`
            SELECT COALESCE(SUM(amount), 0) as lifetime_expenses, COUNT(id) as lifetime_count
            FROM Expenses
        `);

        res.json({
            status: 'SUCCESS',
            data: {
                this_month: monthTotalRows[0],
                today: todayTotalRows[0],
                categories: catBreakdown,
                lifetime: lifetimeRows[0]
            }
        });
    } catch (error) {
        console.error('Get Expense Summary Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.deleteExpense = async (req, res) => {
    const { id } = req.params;
    const userRole = req.user?.role || req.headers['x-user-role'] || 'CASHIER';

    // Enforce Privilege: Only ADMIN can delete expenses
    if (userRole === 'CASHIER') {
        return res.status(403).json({ 
            status: 'ERROR', 
            message: 'کاشێر دەسەڵاتی سڕینەوەی مەساریفی نییە. ئەم کردارە تەنها بۆ بەڕێوەبەر (Admin) ڕێپێدراوە.' 
        });
    }

    try {
        const [existing] = await db.query('SELECT * FROM Expenses WHERE id = ?', [id]);
        const deletedExpense = existing[0] || {};

        await db.query('DELETE FROM Expenses WHERE id = ?', [id]);

        // Audit log expense deletion
        await logAuditAction({
            req,
            action_type: 'EXPENSE_DELETE',
            entity_name: 'Expenses',
            entity_id: id,
            old_value: deletedExpense,
            details: `سڕینەوەی خەرجی "${deletedExpense.title || id}" بە بڕی ${Number(deletedExpense.amount || 0).toLocaleString()} دینار`
        });

        res.json({ status: 'SUCCESS', message: 'خەرجی سڕایەوە' });
    } catch (error) {
        console.error('Delete Expense Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};
