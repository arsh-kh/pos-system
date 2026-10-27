const db = require('../db');

exports.getDashboardStats = async (req, res) => {
    try {
        // This Month Sales
        const [thisMonth] = await db.query(`
            SELECT SUM(total_amount) as total_sales, SUM(total_profit) as total_profit, COUNT(id) as total_invoices 
            FROM Sales 
            WHERE MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())
        `);

        // Last Month Sales (بۆ بەراوردی مانگانە Month-over-Month)
        const [lastMonth] = await db.query(`
            SELECT COALESCE(SUM(total_amount), 0) as total_sales 
            FROM Sales 
            WHERE MONTH(created_at) = MONTH(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH)) 
              AND YEAR(created_at) = YEAR(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH))
        `);
        const lastMonthSales = Number(lastMonth[0]?.total_sales) || 0;

        // This Month Expenses
        const [expensesMonth] = await db.query(`
            SELECT COALESCE(SUM(amount), 0) as total_expenses 
            FROM Expenses 
            WHERE MONTH(expense_date) = MONTH(CURRENT_DATE()) AND YEAR(expense_date) = YEAR(CURRENT_DATE())
        `);

        // This Month Customer Returns (گەڕێنراوەی کڕیار)
        const [returnsMonth] = await db.query(`
            SELECT 
                COALESCE(SUM(r.refunded_amount), 0) as total_refunded,
                COALESCE(SUM(r.refunded_amount - (r.quantity * r.units_multiplier * COALESCE(p.cost_price, 0))), 0) as returned_profit,
                COUNT(r.id) as total_returns_count
            FROM Returns r
            LEFT JOIN Products p ON r.product_id = p.id
            WHERE MONTH(r.created_at) = MONTH(CURRENT_DATE()) AND YEAR(r.created_at) = YEAR(CURRENT_DATE())
        `);

        // This Month Wastage / Damages Loss (زیان و فەوتانی بێداهات)
        const [damagesMonth] = await db.query(`
            SELECT 
                COALESCE(SUM(total_cost_loss), 0) as total_damages_loss,
                COALESCE(SUM(quantity * units_multiplier), 0) as total_damages_units,
                COUNT(id) as total_damages_records 
            FROM Damages 
            WHERE MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())
        `);

        const totalExpenses = Number(expensesMonth[0].total_expenses) || 0;
        const totalRefunded = Number(returnsMonth[0].total_refunded) || 0;
        const returnedProfit = Math.max(0, Number(returnsMonth[0].returned_profit) || 0);
        const totalReturnsCount = Number(returnsMonth[0].total_returns_count) || 0;

        const totalDamagesLoss = Number(damagesMonth[0].total_damages_loss) || 0;
        const totalDamagesUnits = Number(damagesMonth[0].total_damages_units) || 0;
        const totalDamagesRecords = Number(damagesMonth[0].total_damages_records) || 0;

        const rawSales = Number(thisMonth[0].total_sales) || 0;
        const rawGrossProfit = Number(thisMonth[0].total_profit) || 0;

        // Net Sales after Customer Returns
        const netSales = Math.max(0, rawSales - totalRefunded);
        // Adjusted Gross Profit after returned items
        const adjustedGrossProfit = rawGrossProfit - returnedProfit;
        // True Net Profit: Adjusted Gross Profit - Store Expenses - Wastage Loss
        const netProfit = adjustedGrossProfit - totalExpenses - totalDamagesLoss;

        // Daily Chart Data (Sales net of returns)
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
                    raw_sales: rawSales,
                    total_sales: netSales,
                    last_month_sales: lastMonthSales,
                    total_refunded: totalRefunded,
                    total_returns_count: totalReturnsCount,
                    raw_gross_profit: rawGrossProfit,
                    gross_profit: adjustedGrossProfit,
                    total_expenses: totalExpenses,
                    total_damages_loss: totalDamagesLoss,
                    total_damages_units: totalDamagesUnits,
                    total_damages_records: totalDamagesRecords,
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

        // Lifetime returns, expenses, and damages
        const [lifetimeRefunds] = await db.query(`
            SELECT 
                COALESCE(SUM(r.refunded_amount), 0) as total_refunded,
                COALESCE(SUM(r.refunded_amount - (r.quantity * r.units_multiplier * COALESCE(p.cost_price, 0))), 0) as returned_profit
            FROM Returns r
            LEFT JOIN Products p ON r.product_id = p.id
        `);
        const [lifetimeExpenses] = await db.query("SELECT COALESCE(SUM(amount), 0) as total_expenses FROM Expenses");
        const [lifetimeDamages] = await db.query("SELECT COALESCE(SUM(total_cost_loss), 0) as total_damages_loss FROM Damages");

        const rawLifetimeSales = Number(lifetimeRows[0].lifetime_sales) || 0;
        const rawLifetimeProfit = Number(lifetimeRows[0].lifetime_profit) || 0;
        const lifetimeRefunded = Number(lifetimeRefunds[0]?.total_refunded) || 0;
        const lifetimeReturnedProfit = Math.max(0, Number(lifetimeRefunds[0]?.returned_profit) || 0);
        const lifetimeExpensesAmount = Number(lifetimeExpenses[0]?.total_expenses) || 0;
        const lifetimeDamagesLoss = Number(lifetimeDamages[0]?.total_damages_loss) || 0;

        const netLifetimeSales = Math.max(0, rawLifetimeSales - lifetimeRefunded);
        const netLifetimeProfit = rawLifetimeProfit - lifetimeReturnedProfit - lifetimeExpensesAmount - lifetimeDamagesLoss;

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
                    sales: netLifetimeSales,
                    profit: netLifetimeProfit,
                    raw_sales: rawLifetimeSales,
                    raw_profit: rawLifetimeProfit,
                    total_refunded: lifetimeRefunded,
                    total_expenses: lifetimeExpensesAmount,
                    total_damages: lifetimeDamagesLoss,
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

// -------------------------------------------------------------
// Universal Reporting Engine: Day, Week, Month, Year & Custom Ranges
// -------------------------------------------------------------
exports.getPeriodReport = async (req, res) => {
    try {
        const { range = 'month', startDate: customStart, endDate: customEnd } = req.query;

        let startDateTime = '';
        let endDateTime = '';
        let rangeLabelKu = '';
        let groupFormat = '%Y-%m-%d';
        let isHourly = false;

        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        if (range === 'today') {
            startDateTime = `${todayStr} 00:00:00`;
            endDateTime = `${todayStr} 23:59:59`;
            rangeLabelKu = `ئەمڕۆ (${todayStr})`;
            isHourly = true;
        } else if (range === 'week') {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(now.getDate() - 6);
            const wY = sevenDaysAgo.getFullYear();
            const wM = String(sevenDaysAgo.getMonth() + 1).padStart(2, '0');
            const wD = String(sevenDaysAgo.getDate()).padStart(2, '0');
            startDateTime = `${wY}-${wM}-${wD} 00:00:00`;
            endDateTime = `${todayStr} 23:59:59`;
            rangeLabelKu = `ئەم هەفتەیە (${wY}-${wM}-${wD} تا ${todayStr})`;
        } else if (range === 'year') {
            startDateTime = `${yyyy}-01-01 00:00:00`;
            endDateTime = `${yyyy}-12-31 23:59:59`;
            rangeLabelKu = `ئەمساڵ (${yyyy})`;
            groupFormat = '%Y-%m';
        } else if (range === 'custom' && customStart && customEnd) {
            startDateTime = `${customStart} 00:00:00`;
            endDateTime = `${customEnd} 23:59:59`;
            rangeLabelKu = `ماوەی دیاریکراو (${customStart} تا ${customEnd})`;
            const diffDays = Math.ceil((new Date(customEnd) - new Date(customStart)) / (1000 * 60 * 60 * 24));
            if (diffDays > 45) {
                groupFormat = '%Y-%m';
            }
        } else {
            // Default: month
            const firstDayOfMonth = `${yyyy}-${mm}-01 00:00:00`;
            const lastDayObj = new Date(yyyy, now.getMonth() + 1, 0);
            const lastDayOfMonth = `${yyyy}-${mm}-${String(lastDayObj.getDate()).padStart(2, '0')} 23:59:59`;
            startDateTime = firstDayOfMonth;
            endDateTime = lastDayOfMonth;
            rangeLabelKu = `ئەم مانگە (${yyyy}-${mm})`;
        }

        // 1. Sales & Invoices in period
        const [salesRows] = await db.query(`
            SELECT 
                COALESCE(SUM(total_amount), 0) as total_sales,
                COALESCE(SUM(total_profit), 0) as total_profit,
                COALESCE(SUM(subtotal_amount), 0) as subtotal_sales,
                COALESCE(SUM(discount_amount), 0) as total_discounts,
                COALESCE(SUM(paid_amount), 0) as cash_collected,
                COALESCE(SUM(debt_amount), 0) as debt_issued,
                COUNT(id) as total_invoices
            FROM Sales 
            WHERE created_at BETWEEN ? AND ?
        `, [startDateTime, endDateTime]);

        // 2. Returns in period
        const [returnsRows] = await db.query(`
            SELECT 
                COALESCE(SUM(r.refunded_amount), 0) as total_refunded,
                COALESCE(SUM(r.refunded_amount - (r.quantity * r.units_multiplier * COALESCE(p.cost_price, 0))), 0) as returned_profit,
                COUNT(r.id) as returns_count
            FROM Returns r
            LEFT JOIN Products p ON r.product_id = p.id
            WHERE r.created_at BETWEEN ? AND ?
        `, [startDateTime, endDateTime]);

        // 3. Expenses in period
        const [expensesRows] = await db.query(`
            SELECT COALESCE(SUM(amount), 0) as total_expenses, COUNT(id) as expenses_count
            FROM Expenses 
            WHERE expense_date BETWEEN DATE(?) AND DATE(?)
        `, [startDateTime, endDateTime]);

        // 4. Damages in period
        const [damagesRows] = await db.query(`
            SELECT 
                COALESCE(SUM(total_cost_loss), 0) as total_damages_loss,
                COALESCE(SUM(quantity * units_multiplier), 0) as total_damages_units,
                COUNT(id) as damages_count
            FROM Damages 
            WHERE created_at BETWEEN ? AND ?
        `, [startDateTime, endDateTime]);

        // 5. Timeline Chart Data
        let chartData = [];
        if (isHourly) {
            const [hourlyRows] = await db.query(`
                SELECT 
                    HOUR(created_at) as hour, 
                    COALESCE(SUM(total_amount), 0) as sales, 
                    COALESCE(SUM(total_profit), 0) as profit, 
                    COUNT(id) as invoices 
                FROM Sales 
                WHERE created_at BETWEEN ? AND ?
                GROUP BY HOUR(created_at) 
                ORDER BY hour ASC
            `, [startDateTime, endDateTime]);

            const hourMap = new Map();
            hourlyRows.forEach(r => hourMap.set(Number(r.hour), { sales: Number(r.sales), profit: Number(r.profit), invoices: Number(r.invoices) }));
            for (let h = 0; h < 24; h++) {
                const entry = hourMap.get(h) || { sales: 0, profit: 0, invoices: 0 };
                chartData.push({
                    period_key: `${h.toString().padStart(2, '0')}:00`,
                    label: `${h.toString().padStart(2, '0')}:00`,
                    sales: entry.sales,
                    profit: entry.profit,
                    invoices: entry.invoices
                });
            }
        } else {
            const [periodRows] = await db.query(`
                SELECT 
                    DATE_FORMAT(created_at, ?) as period_key, 
                    COALESCE(SUM(total_amount), 0) as sales, 
                    COALESCE(SUM(total_profit), 0) as profit, 
                    COUNT(id) as invoices 
                FROM Sales 
                WHERE created_at BETWEEN ? AND ?
                GROUP BY DATE_FORMAT(created_at, ?) 
                ORDER BY period_key ASC
            `, [groupFormat, startDateTime, endDateTime, groupFormat]);

            chartData = periodRows.map(r => ({
                period_key: r.period_key,
                label: r.period_key,
                sales: Number(r.sales) || 0,
                profit: Number(r.profit) || 0,
                invoices: Number(r.invoices) || 0
            }));
        }

        // 6. Top 5 Best Selling Products in this period
        const [topProducts] = await db.query(`
            SELECT 
                p.id,
                COALESCE(si.custom_name, p.name) as name,
                p.barcode,
                p.is_weighted,
                p.unit,
                COALESCE(SUM(si.quantity * si.units_per_box), 0) as total_quantity,
                COALESCE(SUM(si.quantity * si.price_at_sale), 0) as total_revenue
            FROM Sale_Items si
            JOIN Sales s ON si.sale_id = s.id
            LEFT JOIN Products p ON si.product_id = p.id
            WHERE s.created_at BETWEEN ? AND ?
            GROUP BY p.id, si.custom_name, p.name, p.barcode, p.is_weighted, p.unit
            ORDER BY total_quantity DESC
            LIMIT 5
        `, [startDateTime, endDateTime]);

        // Compute Metrics
        const rawSales = Number(salesRows[0].total_sales) || 0;
        const totalProfitRaw = Number(salesRows[0].total_profit) || 0;
        const totalDiscounts = Number(salesRows[0].total_discounts) || 0;
        const totalInvoices = Number(salesRows[0].total_invoices) || 0;
        const cashCollected = Number(salesRows[0].cash_collected) || 0;
        const debtIssued = Number(salesRows[0].debt_issued) || 0;

        const totalRefunded = Number(returnsRows[0].total_refunded) || 0;
        const returnedProfit = Math.max(0, Number(returnsRows[0].returned_profit) || 0);
        const returnsCount = Number(returnsRows[0].returns_count) || 0;

        const totalExpenses = Number(expensesRows[0].total_expenses) || 0;
        const expensesCount = Number(expensesRows[0].expenses_count) || 0;

        const totalDamagesLoss = Number(damagesRows[0].total_damages_loss) || 0;
        const totalDamagesUnits = Number(damagesRows[0].total_damages_units) || 0;

        const netSales = Math.max(0, rawSales - totalRefunded);
        const adjustedGrossProfit = Math.max(0, totalProfitRaw - returnedProfit);
        const netProfit = adjustedGrossProfit - totalExpenses - totalDamagesLoss;
        const profitMargin = netSales > 0 ? ((netProfit / netSales) * 100).toFixed(1) : 0;
        const avgInvoice = totalInvoices > 0 ? Math.round(netSales / totalInvoices) : 0;

        res.json({
            status: 'SUCCESS',
            data: {
                range,
                range_label: rangeLabelKu,
                start_date: startDateTime,
                end_date: endDateTime,
                metrics: {
                    raw_sales: rawSales,
                    total_sales: netSales,
                    total_invoices: totalInvoices,
                    avg_invoice: avgInvoice,
                    total_discounts: totalDiscounts,
                    cash_collected: cashCollected,
                    debt_issued: debtIssued,
                    gross_profit: adjustedGrossProfit,
                    total_refunded: totalRefunded,
                    returns_count: returnsCount,
                    total_expenses: totalExpenses,
                    expenses_count: expensesCount,
                    total_damages_loss: totalDamagesLoss,
                    total_damages_units: totalDamagesUnits,
                    net_profit: netProfit,
                    profit_margin: Number(profitMargin)
                },
                top_products: topProducts.map(p => ({
                    id: p.id,
                    name: p.name || 'کاڵا',
                    barcode: p.barcode || '-',
                    total_quantity: Number(p.total_quantity) || 0,
                    total_revenue: Number(p.total_revenue) || 0
                })),
                chart_data: chartData
            }
        });
    } catch (error) {
        console.error('getPeriodReport error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};
