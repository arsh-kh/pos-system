const db = require('../db');

exports.getDashboardStats = async (req, res) => {
    try {
        // This Month Sales
        const [thisMonth] = await db.query(`
            SELECT SUM(total_amount) as total_sales, SUM(total_profit) as total_profit, COUNT(id) as total_invoices 
            FROM Sales 
            WHERE MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())
        `);

        // This Month Expenses
        const [expensesMonth] = await db.query(`
            SELECT COALESCE(SUM(amount), 0) as total_expenses 
            FROM Expenses 
            WHERE MONTH(expense_date) = MONTH(CURRENT_DATE()) AND YEAR(expense_date) = YEAR(CURRENT_DATE())
        `);
        const totalExpenses = Number(expensesMonth[0].total_expenses) || 0;
        const grossProfit = Number(thisMonth[0].total_profit) || 0;
        const netProfit = grossProfit - totalExpenses;

        // Daily Chart Data
        const [dailyStats] = await db.query(`
            SELECT DATE(created_at) as date, SUM(total_amount) as sales, SUM(total_profit) as profit 
            FROM Sales 
            WHERE created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);

        res.json({ 
            status: 'SUCCESS', 
            data: { 
                current_month: {
                    ...thisMonth[0],
                    total_expenses: totalExpenses,
                    net_profit: netProfit
                }, 
                chart_data: dailyStats 
            } 
        });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.getHourlyStats = async (req, res) => {
    const { date } = req.query; // Format: YYYY-MM-DD
    try {
        const queryDate = date ? date : 'CURRENT_DATE()';
        
        const [hourlyStats] = await db.query(`
            SELECT HOUR(created_at) as hour, SUM(total_amount) as sales, SUM(total_profit) as profit 
            FROM Sales 
            WHERE DATE(created_at) = ?
            GROUP BY HOUR(created_at)
            ORDER BY hour ASC
        `, [queryDate]);

        res.json({ status: 'SUCCESS', data: hourlyStats });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

// Phase 8: Total Sales & Multi-Month Analytics Overview
exports.getOverview = async (req, res) => {
    try {
        // 1. Lifetime totals
        const [lifetimeRows] = await db.query(`
            SELECT 
                COALESCE(SUM(total_amount), 0) as lifetime_sales, 
                COALESCE(SUM(total_profit), 0) as lifetime_profit, 
                COUNT(id) as lifetime_invoices 
            FROM Sales
        `);

        // 2. Month-by-month breakdown
        const [monthsRows] = await db.query(`
            SELECT 
                DATE_FORMAT(created_at, '%Y-%m') as month, 
                COALESCE(SUM(total_amount), 0) as sales, 
                COALESCE(SUM(total_profit), 0) as profit, 
                COUNT(id) as invoice_count 
            FROM Sales 
            GROUP BY DATE_FORMAT(created_at, '%Y-%m') 
            ORDER BY month DESC
        `);

        const months = monthsRows.map(m => ({
            month: m.month,
            sales: Number(m.sales) || 0,
            profit: Number(m.profit) || 0,
            invoice_count: Number(m.invoice_count) || 0
        }));

        const totalMonthsCount = months.length;
        const highestMonth = months.reduce((max, curr) => (curr.sales > (max?.sales || 0) ? curr : max), months[0] || null);
        const totalSalesSum = months.reduce((acc, curr) => acc + curr.sales, 0);
        const averageMonthSales = totalMonthsCount > 0 ? Math.round(totalSalesSum / totalMonthsCount) : 0;

        res.json({
            status: 'SUCCESS',
            data: {
                lifetime: {
                    sales: Number(lifetimeRows[0].lifetime_sales) || 0,
                    profit: Number(lifetimeRows[0].lifetime_profit) || 0,
                    invoices: Number(lifetimeRows[0].lifetime_invoices) || 0
                },
                total_months_count: totalMonthsCount,
                highest_month: highestMonth,
                average_month_sales: averageMonthSales,
                months
            }
        });
    } catch (error) {
        console.error('getOverview error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

// Phase 8: Days breakdown of a selected month (YYYY-MM)
exports.getMonthDays = async (req, res) => {
    try {
        const { month } = req.query;
        if (!month) {
            return res.status(400).json({ status: 'ERROR', message: 'مانگ پێویستە (Format: YYYY-MM)' });
        }

        const [daysRows] = await db.query(`
            SELECT 
                DATE_FORMAT(created_at, '%Y-%m-%d') as date, 
                DAY(created_at) as day, 
                COALESCE(SUM(total_amount), 0) as sales, 
                COALESCE(SUM(total_profit), 0) as profit, 
                COUNT(id) as invoice_count 
            FROM Sales 
            WHERE DATE_FORMAT(created_at, '%Y-%m') = ? 
            GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d'), DAY(created_at) 
            ORDER BY date ASC
        `, [month]);

        const days = daysRows.map(d => ({
            date: d.date,
            day: Number(d.day),
            sales: Number(d.sales) || 0,
            profit: Number(d.profit) || 0,
            invoice_count: Number(d.invoice_count) || 0
        }));

        const monthSales = days.reduce((sum, d) => sum + d.sales, 0);
        const monthProfit = days.reduce((sum, d) => sum + d.profit, 0);
        const monthInvoices = days.reduce((sum, d) => sum + d.invoice_count, 0);

        res.json({
            status: 'SUCCESS',
            data: {
                month,
                month_sales: monthSales,
                month_profit: monthProfit,
                month_invoices: monthInvoices,
                days
            }
        });
    } catch (error) {
        console.error('getMonthDays error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

// Phase 8: 24-Hour hourly breakdown for a selected date (YYYY-MM-DD)
exports.getDayHours = async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ status: 'ERROR', message: 'بەروار پێویستە (Format: YYYY-MM-DD)' });
        }

        const [rows] = await db.query(`
            SELECT 
                HOUR(created_at) as hour, 
                COALESCE(SUM(total_amount), 0) as sales, 
                COALESCE(SUM(total_profit), 0) as profit, 
                COUNT(id) as invoice_count 
            FROM Sales 
            WHERE DATE(created_at) = ? 
            GROUP BY HOUR(created_at) 
            ORDER BY hour ASC
        `, [date]);

        const hourMap = new Map();
        rows.forEach(r => {
            hourMap.set(Number(r.hour), {
                sales: Number(r.sales) || 0,
                profit: Number(r.profit) || 0,
                invoice_count: Number(r.invoice_count) || 0
            });
        });

        // Generate full 24 hours timeline (0 to 23)
        const full24Hours = [];
        for (let h = 0; h < 24; h++) {
            const entry = hourMap.get(h) || { sales: 0, profit: 0, invoice_count: 0 };
            const hourLabel = `${h.toString().padStart(2, '0')}:00`;
            full24Hours.push({
                hour: h,
                hour_label: hourLabel,
                sales: entry.sales,
                profit: entry.profit,
                invoice_count: entry.invoice_count
            });
        }

        const daySales = full24Hours.reduce((sum, h) => sum + h.sales, 0);
        const dayProfit = full24Hours.reduce((sum, h) => sum + h.profit, 0);
        const dayInvoices = full24Hours.reduce((sum, h) => sum + h.invoice_count, 0);

        res.json({
            status: 'SUCCESS',
            data: {
                date,
                day_sales: daySales,
                day_profit: dayProfit,
                day_invoices: dayInvoices,
                hours: full24Hours
            }
        });
    } catch (error) {
        console.error('getDayHours error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

// Phase 8: Add manual sale for past date
exports.addManualSale = async (req, res) => {
    try {
        const { date, time, total_amount, total_profit, note } = req.body;
        if (!date || !total_amount) {
            return res.status(400).json({ status: 'ERROR', message: 'بەروار و کۆی فرۆشتن پێویستن' });
        }

        const saleTime = time && time.trim() ? time.trim() : '12:00:00';
        const createdAt = `${date} ${saleTime}`;
        const amount = BigInt(Math.round(Number(total_amount)));
        const profit = total_profit ? BigInt(Math.round(Number(total_profit))) : BigInt(0);

        const [result] = await db.query(`
            INSERT INTO Sales (total_amount, total_profit, created_at) 
            VALUES (?, ?, ?)
        `, [amount.toString(), profit.toString(), createdAt]);

        res.json({
            status: 'SUCCESS',
            message: 'فرۆشتن بە سەرکەوتوویی تۆمارکرا',
            data: {
                id: result.insertId,
                total_amount: amount.toString(),
                total_profit: profit.toString(),
                created_at: createdAt,
                note: note || null
            }
        });
    } catch (error) {
        console.error('addManualSale error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};
