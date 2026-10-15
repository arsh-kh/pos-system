const db = require('../db');

exports.getCurrentShift = async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM Shifts WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1");
        if (rows.length === 0) {
            return res.json({ status: 'SUCCESS', data: null });
        }

        const shift = rows[0];
        const openedAt = shift.opened_at;

        // 1. Sales in this shift
        const [salesRows] = await db.query(
            "SELECT COALESCE(SUM(total_amount), 0) as total_sales, COUNT(id) as sale_count FROM Sales WHERE created_at >= ?",
            [openedAt]
        );
        const totalSales = Number(salesRows[0].total_sales) || 0;
        const saleCount = Number(salesRows[0].sale_count) || 0;

        // 2. Debt sales in this shift
        const [debtRows] = await db.query(
            "SELECT COALESCE(SUM(amount), 0) as debt_sales FROM Customer_Debts WHERE transaction_type = 'ADD' AND created_at >= ?",
            [openedAt]
        );
        const debtSales = Number(debtRows[0].debt_sales) || 0;
        const cashSales = Math.max(0, totalSales - debtSales);

        // 3. Expenses during this shift
        const [expenseRows] = await db.query(
            "SELECT COALESCE(SUM(amount), 0) as expenses_paid, COUNT(id) as expense_count FROM Expenses WHERE created_at >= ?",
            [openedAt]
        );
        const expensesPaid = Number(expenseRows[0].expenses_paid) || 0;

        // 4. Expected cash in register
        const openingCash = Number(shift.opening_cash) || 0;
        const expectedCash = openingCash + cashSales - expensesPaid;

        res.json({
            status: 'SUCCESS',
            data: {
                shift,
                stats: {
                    opening_cash: openingCash,
                    total_sales: totalSales,
                    cash_sales: cashSales,
                    debt_sales: debtSales,
                    expenses_paid: expensesPaid,
                    expected_cash: expectedCash,
                    sale_count: saleCount
                }
            }
        });
    } catch (error) {
        console.error('Get Current Shift Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.openShift = async (req, res) => {
    const { cashier_name, opening_cash } = req.body;
    try {
        const [existing] = await db.query("SELECT id FROM Shifts WHERE status = 'OPEN' LIMIT 1");
        if (existing.length > 0) {
            return res.status(400).json({ status: 'ERROR', message: 'شیفتێکی کراوە بوونی هەیە، تکایە سەرەتا دایبخە' });
        }

        const openFloat = Math.max(0, Math.round(Number(opening_cash) || 0));
        const name = cashier_name?.trim() || 'کاشێری سەرەکی';

        const [result] = await db.query(
            "INSERT INTO Shifts (cashier_name, opening_cash, status) VALUES (?, ?, 'OPEN')",
            [name, openFloat]
        );

        res.status(201).json({
            status: 'SUCCESS',
            message: 'شیفتی نوێ بە سەرکەوتوویی کرایەوە',
            data: { id: result.insertId, cashier_name: name, opening_cash: openFloat }
        });
    } catch (error) {
        console.error('Open Shift Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.closeShift = async (req, res) => {
    const { id } = req.params;
    const { actual_cash, notes } = req.body;

    try {
        const [rows] = await db.query("SELECT * FROM Shifts WHERE id = ? AND status = 'OPEN'", [id]);
        if (rows.length === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'شیفتی کراوە نەدۆزرایەوە' });
        }

        const shift = rows[0];
        const openedAt = shift.opened_at;

        // Calculate real-time stats
        const [salesRows] = await db.query(
            "SELECT COALESCE(SUM(total_amount), 0) as total_sales FROM Sales WHERE created_at >= ?",
            [openedAt]
        );
        const totalSales = Number(salesRows[0].total_sales) || 0;

        const [debtRows] = await db.query(
            "SELECT COALESCE(SUM(amount), 0) as debt_sales FROM Customer_Debts WHERE transaction_type = 'ADD' AND created_at >= ?",
            [openedAt]
        );
        const debtSales = Number(debtRows[0].debt_sales) || 0;
        const cashSales = Math.max(0, totalSales - debtSales);

        const [expenseRows] = await db.query(
            "SELECT COALESCE(SUM(amount), 0) as expenses_paid FROM Expenses WHERE created_at >= ?",
            [openedAt]
        );
        const expensesPaid = Number(expenseRows[0].expenses_paid) || 0;

        const openingCash = Number(shift.opening_cash) || 0;
        const expectedCash = openingCash + cashSales - expensesPaid;
        const countedCash = Math.max(0, Math.round(Number(actual_cash) || 0));
        const diff = countedCash - expectedCash;

        await db.query(`
            UPDATE Shifts SET 
                closed_at = CURRENT_TIMESTAMP,
                cash_sales = ?,
                debt_sales = ?,
                expenses_paid = ?,
                expected_cash = ?,
                actual_cash = ?,
                difference = ?,
                status = 'CLOSED',
                notes = ?
            WHERE id = ?
        `, [cashSales, debtSales, expensesPaid, expectedCash, countedCash, diff, notes || null, id]);

        const [updatedRows] = await db.query("SELECT * FROM Shifts WHERE id = ?", [id]);

        res.json({
            status: 'SUCCESS',
            message: 'شیفت بە سەرکەوتوویی داخرا و ڕاپۆرتی Z-Report ئامادەکرا',
            data: updatedRows[0]
        });
    } catch (error) {
        console.error('Close Shift Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.getAllShifts = async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM Shifts ORDER BY id DESC");
        res.json({ status: 'SUCCESS', data: rows });
    } catch (error) {
        console.error('Get All Shifts Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};
