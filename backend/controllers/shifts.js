const db = require('../db');
const { logAuditAction } = require('../middleware/auditLogger');

exports.getCurrentShift = async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM Shifts WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1");
        if (rows.length === 0) {
            return res.json({ status: 'SUCCESS', data: null });
        }

        const shift = rows[0];
        const openedAt = shift.opened_at;

        // 1. Sales in this shift - exactly querying paid_amount (cash) and debt_amount
        const [salesRows] = await db.query(
            "SELECT COALESCE(SUM(total_amount), 0) as total_sales, COALESCE(SUM(paid_amount), 0) as cash_sales, COALESCE(SUM(debt_amount), 0) as debt_sales, COUNT(id) as sale_count FROM Sales WHERE created_at >= ?",
            [openedAt]
        );
        const totalSales = Number(salesRows[0].total_sales) || 0;
        const cashSales = Number(salesRows[0].cash_sales) || 0;
        const debtSales = Number(salesRows[0].debt_sales) || 0;
        const saleCount = Number(salesRows[0].sale_count) || 0;

        // 2. Debtor cash payments collected during this shift (Customer payments made in cash where sale_id IS NULL)
        const [debtRepayRows] = await db.query(
            "SELECT COALESCE(SUM(amount), 0) as debt_repaid FROM Customer_Debts WHERE transaction_type = 'PAY' AND sale_id IS NULL AND created_at >= ?",
            [openedAt]
        );
        const debtRepaidCash = Number(debtRepayRows[0].debt_repaid) || 0;

        // 3. Cash refunds during this shift
        const [refundRows] = await db.query(
            "SELECT COALESCE(SUM(refunded_amount), 0) as cash_refunds, COUNT(id) as refund_count FROM Returns WHERE refund_method = 'CASH' AND created_at >= ?",
            [openedAt]
        );
        const cashRefunds = Number(refundRows[0].cash_refunds) || 0;
        const refundCount = Number(refundRows[0].refund_count) || 0;

        // 4. Expenses during this shift
        const [expenseRows] = await db.query(
            "SELECT COALESCE(SUM(amount), 0) as expenses_paid, COUNT(id) as expense_count FROM Expenses WHERE created_at >= ?",
            [openedAt]
        );
        const expensesPaid = Number(expenseRows[0].expenses_paid) || 0;

        // 5. Expected cash in register (Opening Cash + Cash Sales + Debtor Cash Payments - Expenses - Cash Refunds)
        const openingCash = Number(shift.opening_cash) || 0;
        const expectedCash = openingCash + cashSales + debtRepaidCash - expensesPaid - cashRefunds;

        res.json({
            status: 'SUCCESS',
            data: {
                shift,
                stats: {
                    opening_cash: openingCash,
                    total_sales: totalSales,
                    cash_sales: cashSales,
                    debt_sales: debtSales,
                    debt_repaid_cash: debtRepaidCash,
                    cash_refunds: cashRefunds,
                    expenses_paid: expensesPaid,
                    expected_cash: expectedCash,
                    sale_count: saleCount,
                    refund_count: refundCount
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

        // Audit log shift opening
        await logAuditAction({
            req,
            action_type: 'SHIFT_OPEN',
            entity_name: 'Shifts',
            entity_id: result.insertId,
            new_value: { cashier_name: name, opening_cash: openFloat },
            details: `کردنەوەی شیفتی نوێ بە ناوی "${name}"، سەرمایەی سەرەتای قاسە: ${openFloat.toLocaleString()} دینار`
        });

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
            "SELECT COALESCE(SUM(total_amount), 0) as total_sales, COALESCE(SUM(paid_amount), 0) as cash_sales, COALESCE(SUM(debt_amount), 0) as debt_sales FROM Sales WHERE created_at >= ?",
            [openedAt]
        );
        const totalSales = Number(salesRows[0].total_sales) || 0;
        const cashSales = Number(salesRows[0].cash_sales) || 0;
        const debtSales = Number(salesRows[0].debt_sales) || 0;

        const [debtRepayRows] = await db.query(
            "SELECT COALESCE(SUM(amount), 0) as debt_repaid FROM Customer_Debts WHERE transaction_type = 'PAY' AND sale_id IS NULL AND created_at >= ?",
            [openedAt]
        );
        const debtRepaidCash = Number(debtRepayRows[0].debt_repaid) || 0;

        const [refundRows] = await db.query(
            "SELECT COALESCE(SUM(refunded_amount), 0) as cash_refunds FROM Returns WHERE refund_method = 'CASH' AND created_at >= ?",
            [openedAt]
        );
        const cashRefunds = Number(refundRows[0].cash_refunds) || 0;

        const [expenseRows] = await db.query(
            "SELECT COALESCE(SUM(amount), 0) as expenses_paid FROM Expenses WHERE created_at >= ?",
            [openedAt]
        );
        const expensesPaid = Number(expenseRows[0].expenses_paid) || 0;

        const openingCash = Number(shift.opening_cash) || 0;
        const expectedCash = openingCash + cashSales + debtRepaidCash - expensesPaid - cashRefunds;
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

        // Audit log shift closing
        await logAuditAction({
            req,
            action_type: 'SHIFT_CLOSE',
            entity_name: 'Shifts',
            entity_id: id,
            new_value: { expected_cash: expectedCash, actual_cash: countedCash, difference: diff, notes },
            details: `داخستنی شیفت #${id}: ژمێردراوی ڕاستەقینە ${countedCash.toLocaleString()} دینار، پێشبینیکراو ${expectedCash.toLocaleString()} دینار، جیاوازی: ${diff === 0 ? '٠ (تەواو)' : diff > 0 ? `+${diff.toLocaleString()} (زیادە)` : `${diff.toLocaleString()} (کورتهێنان)`}`
        });

        res.json({
            status: 'SUCCESS',
            message: 'شیفت بە سەرکەوتوویی داخرا و ڕاپۆرتی Z دەرچوو',
            data: updatedRows[0]
        });
    } catch (error) {
        console.error('Close Shift Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.getAllShifts = async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM Shifts ORDER BY id DESC LIMIT 50");
        res.json({ status: 'SUCCESS', data: rows });
    } catch (error) {
        console.error('Get All Shifts Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};
