const db = require('../db');
const { logAuditAction } = require('../middleware/auditLogger');
const { sendShiftZReportTelegram } = require('../services/telegramNotification');

exports.getCurrentShift = async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM Shifts WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1");
        let shift = rows[0];
        let openedAt;

        if (!shift) {
            // Auto day fallback: openedAt is today at 00:00:00 so dashboard is always active & restriction-free
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            openedAt = today;
            shift = {
                id: 'TODAY',
                cashier_name: 'کاشێری سەرەکی',
                opened_at: openedAt.toISOString(),
                opening_cash: 0,
                status: 'OPEN',
                is_auto_day: true
            };
        } else {
            openedAt = shift.opened_at;
        }

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
        let shift;
        if (id === 'TODAY' || id === 'current') {
            const [openRows] = await db.query("SELECT * FROM Shifts WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1");
            if (openRows.length > 0) {
                shift = openRows[0];
            } else {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const [createRes] = await db.query(
                    "INSERT INTO Shifts (cashier_name, opened_at, opening_cash, status) VALUES ('کاشێری سەرەکی', ?, 0, 'OPEN')",
                    [today]
                );
                const [newRows] = await db.query("SELECT * FROM Shifts WHERE id = ?", [createRes.insertId]);
                shift = newRows[0];
            }
        } else {
            const [rows] = await db.query("SELECT * FROM Shifts WHERE id = ? AND status = 'OPEN'", [id]);
            if (rows.length === 0) {
                return res.status(404).json({ status: 'ERROR', message: 'شیفتی کراوە نەدۆزرایەوە' });
            }
            shift = rows[0];
        }

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
        const countedCash = (actual_cash !== undefined && actual_cash !== '' && actual_cash !== null)
            ? Math.max(0, Math.round(Number(actual_cash) || 0))
            : expectedCash;
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
        const closedShift = updatedRows[0];

        // Audit log shift closing
        await logAuditAction({
            req,
            action_type: 'SHIFT_CLOSE',
            entity_name: 'Shifts',
            entity_id: id,
            new_value: { expected_cash: expectedCash, actual_cash: countedCash, difference: diff, notes },
            details: `داخستنی شیفت #${id}: ژمێردراوی ڕاستەقینە ${countedCash.toLocaleString()} دینار، پێشبینیکراو ${expectedCash.toLocaleString()} دینار، جیاوازی: ${diff === 0 ? '٠ (تەواو)' : diff > 0 ? `+${diff.toLocaleString()} (زیادە)` : `${diff.toLocaleString()} (کورتهێنان)`}`
        });

        const zReportData = {
            shift_id: closedShift.id,
            cashier_name: closedShift.cashier_name,
            opened_at: closedShift.opened_at,
            closed_at: closedShift.closed_at,
            status: closedShift.status,
            opening_cash: openingCash,
            total_sales: totalSales,
            cash_sales: cashSales,
            debt_sales: debtSales,
            cash_refunds: cashRefunds,
            expenses_paid: expensesPaid,
            expected_cash: expectedCash,
            actual_cash: countedCash,
            difference: diff,
            notes: notes || closedShift.notes
        };

        // Auto dispatch Z-Report to Telegram in background
        sendShiftZReportTelegram(zReportData).catch((err) => {
            console.warn('Shift Telegram notification skipped/failed:', err.message);
        });

        res.json({
            status: 'SUCCESS',
            message: 'شیفت بە سەرکەوتوویی داخرا و ڕاپۆرتی Z دەرچوو',
            data: zReportData
        });
    } catch (error) {
        console.error('Close Shift Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.getZReport = async (req, res) => {
    const { id } = req.params;
    try {
        let shift;
        if (id === 'latest' || id === 'current') {
            const [rows] = await db.query("SELECT * FROM Shifts ORDER BY id DESC LIMIT 1");
            shift = rows[0];
        } else {
            const [rows] = await db.query("SELECT * FROM Shifts WHERE id = ?", [id]);
            shift = rows[0];
        }

        if (!shift) {
            return res.status(404).json({ status: 'ERROR', message: 'شیفت نەدۆزرایەوە' });
        }

        const openedAt = shift.opened_at;
        const closedAt = shift.closed_at || new Date();

        const [salesRows] = await db.query(
            "SELECT COALESCE(SUM(total_amount), 0) as total_sales, COALESCE(SUM(paid_amount), 0) as cash_sales, COALESCE(SUM(debt_amount), 0) as debt_sales, COUNT(id) as sale_count FROM Sales WHERE created_at >= ? AND created_at <= ?",
            [openedAt, closedAt]
        );

        const [debtRepayRows] = await db.query(
            "SELECT COALESCE(SUM(amount), 0) as debt_repaid FROM Customer_Debts WHERE transaction_type = 'PAY' AND sale_id IS NULL AND created_at >= ? AND created_at <= ?",
            [openedAt, closedAt]
        );
        const debtRepaidCash = Number(debtRepayRows[0].debt_repaid) || 0;

        const [refundRows] = await db.query(
            "SELECT COALESCE(SUM(refunded_amount), 0) as cash_refunds, COUNT(id) as refund_count FROM Returns WHERE refund_method = 'CASH' AND created_at >= ? AND created_at <= ?",
            [openedAt, closedAt]
        );

        const [expenseRows] = await db.query(
            "SELECT COALESCE(SUM(amount), 0) as expenses_paid, COUNT(id) as expense_count FROM Expenses WHERE created_at >= ? AND created_at <= ?",
            [openedAt, closedAt]
        );

        const [profitRows] = await db.query(
            "SELECT COALESCE(SUM(total_profit), 0) as total_profit FROM Sales WHERE created_at >= ? AND created_at <= ?",
            [openedAt, closedAt]
        );

        const openingCash = Number(shift.opening_cash) || 0;
        const totalSales = Number(salesRows[0].total_sales) || 0;
        const cashSales = Number(salesRows[0].cash_sales) || 0;
        const debtSales = Number(salesRows[0].debt_sales) || 0;
        const cashRefunds = Number(refundRows[0].cash_refunds) || 0;
        const expensesPaid = Number(expenseRows[0].expenses_paid) || 0;
        const grossProfit = Number(profitRows[0].total_profit) || 0;
        const netProfit = grossProfit - expensesPaid;
        const calculatedExpected = openingCash + cashSales + debtRepaidCash - expensesPaid - cashRefunds;
        const expectedCash = (shift.expected_cash !== null && shift.expected_cash !== undefined) ? Number(shift.expected_cash) : calculatedExpected;
        const actualCash = (shift.actual_cash !== null && shift.actual_cash !== undefined) ? Number(shift.actual_cash) : expectedCash;
        const difference = (shift.difference !== null && shift.difference !== undefined) ? Number(shift.difference) : (actualCash - expectedCash);

        const zReportData = {
            shift_id: shift.id,
            cashier_name: shift.cashier_name,
            opened_at: shift.opened_at,
            closed_at: shift.closed_at,
            status: shift.status,
            opening_cash: openingCash,
            total_sales: totalSales,
            cash_sales: cashSales,
            debt_sales: debtSales,
            debt_repaid_cash: debtRepaidCash,
            cash_refunds: cashRefunds,
            expenses_paid: expensesPaid,
            expected_cash: expectedCash,
            actual_cash: actualCash,
            difference: difference,
            gross_profit: grossProfit,
            net_profit: netProfit,
            sale_count: Number(salesRows[0].sale_count) || 0,
            refund_count: Number(refundRows[0].refund_count) || 0,
            expense_count: Number(expenseRows[0].expense_count) || 0,
            notes: shift.notes
        };

        res.json({
            status: 'SUCCESS',
            data: zReportData
        });
    } catch (error) {
        console.error('getZReport Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.sendZReportTelegram = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query("SELECT * FROM Shifts WHERE id = ?", [id]);
        if (rows.length === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'شیفت نەدۆزرایەوە' });
        }
        const shift = rows[0];
        const zData = {
            shift_id: shift.id,
            cashier_name: shift.cashier_name,
            opened_at: shift.opened_at,
            closed_at: shift.closed_at,
            opening_cash: shift.opening_cash,
            cash_sales: shift.cash_sales,
            debt_sales: shift.debt_sales,
            total_sales: (Number(shift.cash_sales) || 0) + (Number(shift.debt_sales) || 0),
            expenses_paid: shift.expenses_paid,
            expected_cash: shift.expected_cash,
            actual_cash: shift.actual_cash,
            difference: shift.difference,
            notes: shift.notes
        };

        const result = await sendShiftZReportTelegram(zData);
        res.json({
            status: 'SUCCESS',
            message: 'ڕاپۆرتی Z بە سەرکەوتوویی بۆ تێلیگرام نێردرا',
            data: result
        });
    } catch (error) {
        console.error('sendZReportTelegram Error:', error);
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
