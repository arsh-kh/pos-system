const db = require('../db');
const { logAuditAction } = require('../middleware/auditLogger');

// Ensure persistent table for learned expense categories
const ensureCategoriesTable = async () => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS Expense_Categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        const defaultCats = [
            'کرێی دوکان',
            'مووچەی کارمەندان',
            'کارەبا و مۆلیدە',
            'خواردن و میوانداری',
            'پاککردنەوە و پێداویستی',
            'هەمەجۆر / تر'
        ];
        for (const cat of defaultCats) {
            await db.query('INSERT IGNORE INTO Expense_Categories (name) VALUES (?)', [cat]);
        }
    } catch (err) {
        console.warn('Ensure Expense_Categories error:', err.message);
    }
};
ensureCategoriesTable();

exports.getExpenseCategories = async (req, res) => {
    try {
        await ensureCategoriesTable();
        const [rows] = await db.query(`
            SELECT DISTINCT name FROM (
                SELECT name FROM Expense_Categories
                UNION
                SELECT category as name FROM Expenses WHERE category IS NOT NULL AND category != ''
            ) AS combined
            ORDER BY name ASC
        `);
        res.json({
            status: 'SUCCESS',
            data: rows.map(r => r.name)
        });
    } catch (error) {
        console.error('Get Expense Categories Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.createExpense = async (req, res) => {
    const { title, category, amount, expense_date, notes } = req.body;
    const numAmount = Math.max(0, Math.round(Number(amount) || 0));

    const cleanTitle = (title || '').trim();
    const cleanCategory = (category || 'هەمەجۆر / تر').trim();

    if (!cleanTitle || numAmount <= 0) {
        return res.status(400).json({ status: 'ERROR', message: 'تکایە ناوی خەرجی و بڕی پارەی دروست دیاری بکە' });
    }

    try {
        await ensureCategoriesTable();
        // Self-learning: automatically save new category to list
        if (cleanCategory) {
            await db.query('INSERT IGNORE INTO Expense_Categories (name) VALUES (?)', [cleanCategory]);
        }

        const dateVal = expense_date ? expense_date : new Date().toISOString().split('T')[0];
        const [result] = await db.query(
            'INSERT INTO Expenses (title, description, category, amount, expense_date, notes) VALUES (?, ?, ?, ?, ?, ?)',
            [cleanTitle, cleanTitle, cleanCategory, numAmount, dateVal, notes ? notes.trim() : null]
        );

        // Audit log expense creation
        await logAuditAction({
            req,
            action_type: 'EXPENSE_CREATE',
            entity_name: 'Expenses',
            entity_id: result.insertId,
            new_value: { title: cleanTitle, category: cleanCategory, amount: numAmount, expense_date: dateVal, notes },
            details: `تۆمارکردنی خەرجی نوێ: "${cleanTitle}" بە بڕی ${numAmount.toLocaleString()} دینار بۆ جۆری [${cleanCategory}]`
        });

        res.status(201).json({
            status: 'SUCCESS',
            message: 'خەرجی بە سەرکەوتوویی تۆمارکرا',
            data: { id: result.insertId, title: cleanTitle, category: cleanCategory, amount: numAmount, expense_date: dateVal, notes }
        });
    } catch (error) {
        console.error('Create Expense Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.updateExpense = async (req, res) => {
    const { id } = req.params;
    const { title, category, amount, expense_date, notes } = req.body;
    const numAmount = Math.max(0, Math.round(Number(amount) || 0));

    const cleanTitle = (title || '').trim();
    const cleanCategory = (category || 'هەمەجۆر / تر').trim();

    if (!cleanTitle || numAmount <= 0) {
        return res.status(400).json({ status: 'ERROR', message: 'تکایە ناوی خەرجی و بڕی پارەی دروست دیاری بکە' });
    }

    try {
        const [existing] = await db.query('SELECT * FROM Expenses WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'خەرجی نەدۆزرایەوە' });
        }
        const oldExpense = existing[0];

        await ensureCategoriesTable();
        if (cleanCategory) {
            await db.query('INSERT IGNORE INTO Expense_Categories (name) VALUES (?)', [cleanCategory]);
        }

        const dateVal = expense_date ? expense_date : (oldExpense.expense_date || new Date().toISOString().split('T')[0]);

        await db.query(
            'UPDATE Expenses SET title = ?, description = ?, category = ?, amount = ?, expense_date = ?, notes = ? WHERE id = ?',
            [cleanTitle, cleanTitle, cleanCategory, numAmount, dateVal, notes ? notes.trim() : null, id]
        );

        // Audit log
        await logAuditAction({
            req,
            action_type: 'EXPENSE_UPDATE',
            entity_name: 'Expenses',
            entity_id: id,
            old_value: oldExpense,
            new_value: { title: cleanTitle, category: cleanCategory, amount: numAmount, expense_date: dateVal, notes },
            details: `دەستکاریکردنی خەرجی: "${cleanTitle}" بە بڕی ${numAmount.toLocaleString()} دینار`
        });

        res.json({
            status: 'SUCCESS',
            message: 'خەرجی بە سەرکەوتوویی نوێکرایەوە',
            data: { id, title: cleanTitle, category: cleanCategory, amount: numAmount, expense_date: dateVal, notes }
        });
    } catch (error) {
        console.error('Update Expense Error:', error);
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
            message: 'کاشێر دەسەڵاتی سڕینەوەی خەرجی نییە. ئەم کردارە تەنها بۆ بەڕێوەبەر (Admin) ڕێپێدراوە.' 
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
