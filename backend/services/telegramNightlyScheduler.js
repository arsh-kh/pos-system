require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');
const fs = require('fs');
const path = require('path');

const BACKUPS_DIR = path.resolve(__dirname, '../backups');
if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

const DEFAULT_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8928798854:AAGlhCrK1qmBVTbNKlya71WBv_cERTbdX14';

// Helper to safely serialize BigInt and dates
const safeJsonStringify = (data) => {
    return JSON.stringify(data, (key, value) => {
        if (typeof value === 'bigint') {
            return value.toString();
        }
        return value;
    }, 2);
};

// Get Active Bot Token from DB or env
const getActiveBotToken = async () => {
    try {
        const [rows] = await db.query('SELECT bot_token FROM Telegram_Backup_Settings WHERE id = 1');
        if (rows.length > 0 && rows[0].bot_token && rows[0].bot_token.trim()) {
            return rows[0].bot_token.trim();
        }
    } catch (_) {}
    return DEFAULT_BOT_TOKEN;
};

/**
 * Generate full database backup payload with DDL schemas and table records
 */
const buildFullBackupPayload = async (note = 'باکئەپی تەواوی سیستم') => {
    const [tables] = await db.query('SHOW TABLES');
    if (!tables || tables.length === 0) {
        throw new Error('هیچ خشتەیەک لە داتابەیسدا نەدۆزرایەوە');
    }

    const dbNameKey = Object.keys(tables[0])[0];
    const tableNames = tables.map(t => t[dbNameKey]);

    const backupData = {
        metadata: {
            version: '2.0',
            exported_at: new Date().toISOString(),
            database: process.env.DB_NAME || 'pos_db',
            note,
            total_tables: tableNames.length,
            table_counts: {}
        },
        schemas: {},
        tables: {}
    };

    let totalRows = 0;

    for (const tbl of tableNames) {
        try {
            const [schemaRes] = await db.query(`SHOW CREATE TABLE \`${tbl}\``);
            if (schemaRes && schemaRes[0]) {
                const keys = Object.keys(schemaRes[0]);
                backupData.schemas[tbl] = schemaRes[0]['Create Table'] || schemaRes[0][keys[1]];
            }
        } catch (_) {}

        try {
            const [rows] = await db.query(`SELECT * FROM \`${tbl}\``);
            backupData.tables[tbl] = rows;
            backupData.metadata.table_counts[tbl] = rows.length;
            totalRows += rows.length;
        } catch (err) {
            backupData.tables[tbl] = [];
            backupData.metadata.table_counts[tbl] = 0;
        }
    }

    const jsonString = safeJsonStringify(backupData);
    return { backupData, jsonString, totalTables: tableNames.length, totalRows };
};

/**
 * Calculate Daily Financial Rollup for a specific date (defaults to today)
 */
const getDailyFinancialSummary = async (dateStr = null) => {
    const dateCondition = dateStr ? 'DATE(created_at) = DATE(?)' : 'DATE(created_at) = CURDATE()';
    const params = dateStr ? [dateStr] : [];

    // 1. Sales & Revenue
    const [salesRows] = await db.query(`
        SELECT 
            COUNT(id) as total_invoices,
            COALESCE(SUM(total_amount), 0) as total_sales,
            COALESCE(SUM(paid_amount), 0) as cash_sales,
            COALESCE(SUM(debt_amount), 0) as debt_sales,
            COALESCE(SUM(total_profit), 0) as total_profit
        FROM Sales
        WHERE ${dateCondition}
    `, params);

    const s = salesRows[0] || {};
    const totalInvoices = Number(s.total_invoices) || 0;
    const totalSales = Number(s.total_sales) || 0;
    const cashSales = Number(s.cash_sales) || 0;
    const debtSales = Number(s.debt_sales) || 0;
    const grossProfit = Number(s.total_profit) || 0;

    // 2. Customer Debt Repayments (قەرزی هاتۆتەوە بە نەقد)
    const debtRepayDateCondition = dateStr ? 'DATE(cd.created_at) = DATE(?)' : 'DATE(cd.created_at) = CURDATE()';
    const [debtRepayRows] = await db.query(`
        SELECT 
            COALESCE(SUM(cd.amount), 0) as total_debt_collected,
            COUNT(cd.id) as debt_repayments_count
        FROM Customer_Debts cd
        WHERE cd.transaction_type = 'PAY' AND ${debtRepayDateCondition}
    `, params);
    const totalDebtCollected = Number(debtRepayRows[0]?.total_debt_collected) || 0;
    const debtRepaymentsCount = Number(debtRepayRows[0]?.debt_repayments_count) || 0;

    // Detailed customer debt repayments list for today
    const [debtRepaymentDetails] = await db.query(`
        SELECT 
            cd.amount,
            cd.note,
            cd.created_at,
            c.name as customer_name
        FROM Customer_Debts cd
        JOIN Customers c ON cd.customer_id = c.id
        WHERE cd.transaction_type = 'PAY' AND ${debtRepayDateCondition}
        ORDER BY cd.created_at DESC
    `, params);

    // 3. Goods Purchased from Drawer Cash (دراو بە کاڵا لە قاسە)
    const drawerPurchasesDateCondition = dateStr ? 'DATE(created_at) = DATE(?)' : 'DATE(created_at) = CURDATE()';
    const [drawerPurchasesRows] = await db.query(`
        SELECT 
            COALESCE(SUM(amount), 0) as goods_purchased_cash,
            COUNT(id) as goods_purchased_count
        FROM drawer_purchases
        WHERE ${drawerPurchasesDateCondition}
    `, params);
    const goodsPurchasedCash = Number(drawerPurchasesRows[0]?.goods_purchased_cash) || 0;
    const goodsPurchasedCount = Number(drawerPurchasesRows[0]?.goods_purchased_count) || 0;

    // 4. Expenses
    const expenseDateCondition = dateStr ? 'DATE(expense_date) = DATE(?)' : 'DATE(expense_date) = CURDATE()';
    const [expenseRows] = await db.query(`
        SELECT COALESCE(SUM(amount), 0) as total_expenses, COUNT(id) as count_expenses
        FROM Expenses
        WHERE ${expenseDateCondition}
    `, params);
    const totalExpenses = Number(expenseRows[0]?.total_expenses) || 0;

    // 5. Customer Returns
    const returnDateCondition = dateStr ? 'DATE(created_at) = DATE(?)' : 'DATE(created_at) = CURDATE()';
    const [returnRows] = await db.query(`
        SELECT COALESCE(SUM(refunded_amount), 0) as total_refunded, COUNT(id) as count_returns
        FROM Returns
        WHERE ${returnDateCondition}
    `, params);
    const totalRefunded = Number(returnRows[0]?.total_refunded) || 0;

    // 6. Cash Inflow into Drawer (کۆی کاشی هاتوو بۆ قاسە = فرۆشی نەقد + قەرزی وەرگیراو - گەڕاوەی نەقد)
    const totalCashInflow = Math.max(0, cashSales + totalDebtCollected - totalRefunded);

    // 7. Shifts today
    const shiftDateCondition = dateStr ? 'DATE(opened_at) = DATE(?)' : 'DATE(opened_at) = CURDATE()';
    const [shiftRows] = await db.query(`
        SELECT id, cashier_name, status, expected_cash, actual_cash, difference
        FROM Shifts
        WHERE ${shiftDateCondition}
        ORDER BY id DESC
    `, params);

    // Net estimated profit
    const netProfit = grossProfit - totalExpenses;

    const displayDate = dateStr || new Date().toISOString().split('T')[0];

    // Format customer debt repayment breakdown
    let debtBreakdownText = '';
    if (totalDebtCollected > 0 && debtRepaymentDetails.length > 0) {
        if (debtRepaymentDetails.length <= 6) {
            debtBreakdownText = debtRepaymentDetails
                .map(d => `   ▫️ ${d.customer_name}: ${Number(d.amount).toLocaleString()} دینار${d.note ? ` (${d.note})` : ''}`)
                .join('\n');
        } else {
            const top5 = debtRepaymentDetails.slice(0, 5)
                .map(d => `   ▫️ ${d.customer_name}: ${Number(d.amount).toLocaleString()} دینار${d.note ? ` (${d.note})` : ''}`)
                .join('\n');
            debtBreakdownText = `${top5}\n   ▫️ ... و ${debtRepaymentDetails.length - 5} کڕیاری تر`;
        }
    }

    // Format Kurdish Markdown Summary Message
    const formattedMessage = `📊 *کورتەی دارایی و فرۆشی ڕۆژانە*
📅 *بەروار:* \`${displayDate}\`
⏰ *کات:* ${new Date().toLocaleTimeString('en-GB')}

🧾 *کۆی گشتی پسوولەکان:* ${totalInvoices.toLocaleString()} پسوولە
💰 *کۆی فرۆش (داهات):* ${totalSales.toLocaleString()} دینار
💵 *فرۆشی نەقد (کاش):* ${cashSales.toLocaleString()} دینار
📝 *فرۆشی قەرز:* ${debtSales.toLocaleString()} دینار

📥 *قەرزی هاتۆتەوە (نەقد):* +${totalDebtCollected.toLocaleString()} دینار${debtRepaymentsCount > 0 ? ` (${debtRepaymentsCount} کڕیار)` : ''}
${debtBreakdownText ? `${debtBreakdownText}\n` : ''}💰 *کۆی کاشی هاتوو بۆ قاسە:* ${totalCashInflow.toLocaleString()} دینار

📉 *کۆی خەرجییەکان:* ${totalExpenses > 0 ? `-${totalExpenses.toLocaleString()} دینار` : '0 دینار'}
${goodsPurchasedCash > 0 ? `📦 *دراو بە کاڵا لە قاسە:* -${goodsPurchasedCash.toLocaleString()} دینار (${goodsPurchasedCount} کڕین)\n` : ''}🔄 *گەڕاوەی کاڵا (نەقد):* ${totalRefunded > 0 ? `-${totalRefunded.toLocaleString()} دینار` : '0 دینار'}
💎 *قازانجی خاوێنی بەراوردکراو:* ${netProfit.toLocaleString()} دینار

👥 *شیفتەکانی ئەمڕۆ:* ${shiftRows.length > 0 ? shiftRows.map(sh => `${sh.cashier_name} (${sh.status === 'OPEN' ? '🟢 کراوەیە' : '🔴 داخراوە'})`).join('، ') : 'هیچ شیفتێک تۆمار نەکراوە'}

🔒 *سیستەمی پارێزراوی POS - مارکێت*`;

    return {
        displayDate,
        totalInvoices,
        totalSales,
        cashSales,
        debtSales,
        totalDebtCollected,
        debtRepaymentsCount,
        debtRepaymentDetails,
        totalCashInflow,
        goodsPurchasedCash,
        goodsPurchasedCount,
        totalExpenses,
        totalRefunded,
        grossProfit,
        netProfit,
        shifts: shiftRows,
        formattedMessage
    };
};

/**
 * Execute Nightly Broadcast (Summary Report + Full Database JSON Attachment)
 */
const sendNightlyBackupAndSummary = async (isManualTrigger = false) => {
    try {
        const [activeRecipients] = await db.query('SELECT * FROM Telegram_Recipients WHERE is_active = TRUE');
        if (!activeRecipients || activeRecipients.length === 0) {
            console.log('⚠️ [Telegram Nightly] No active recipients found to send nightly summary.');
            return { success: false, reason: 'NO_ACTIVE_RECIPIENTS' };
        }

        const token = await getActiveBotToken();
        const summary = await getDailyFinancialSummary();
        const note = isManualTrigger ? 'ناردنی دەستی کۆتایی ڕۆژ' : 'باکئەپ و کورتەی ئۆتۆماتیکی ۲۳:۵۹ شەوانە';
        const { jsonString, totalTables, totalRows } = await buildFullBackupPayload(note);

        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const filename = `POS_Daily_Backup_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_23-59.json`;
        const localFilePath = path.join(BACKUPS_DIR, filename);

        // Save local copy
        fs.writeFileSync(localFilePath, jsonString, 'utf8');

        const caption = `${summary.formattedMessage}\n\n📁 *پەڕگەی باکئەپ:* \`${filename}\`\n📊 *خشتەکان:* ${totalTables} | *تۆمارەکان:* ${totalRows} دێڕ`;

        const successfulRecipients = [];
        const failedRecipients = [];

        for (const r of activeRecipients) {
            try {
                const formData = new FormData();
                formData.append('chat_id', r.chat_id.trim());
                formData.append('caption', caption);
                formData.append('parse_mode', 'Markdown');

                const fileBlob = new Blob([Buffer.from(jsonString, 'utf8')], { type: 'application/json' });
                formData.append('document', fileBlob, filename);

                const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
                    method: 'POST',
                    body: formData,
                    signal: AbortSignal.timeout(45000)
                });

                const data = await res.json();
                if (data.ok) {
                    successfulRecipients.push(r.recipient_name);
                    await db.query('UPDATE Telegram_Recipients SET last_sent_at = NOW() WHERE id = ?', [r.id]);
                } else {
                    failedRecipients.push(`${r.recipient_name}: ${data.description || 'ڕەتکرایەوە'}`);
                }
            } catch (err) {
                failedRecipients.push(`${r.recipient_name}: ${err.message}`);
            }
        }

        // Record in Telegram_Backup_Settings
        if (successfulRecipients.length > 0) {
            await db.query(`
                UPDATE Telegram_Backup_Settings 
                SET last_sent_at = NOW(),
                    last_status = 'SUCCESS',
                    last_error = NULL,
                    last_filename = ?,
                    last_file_size = ?
                WHERE id = 1
            `, [filename, Buffer.byteLength(jsonString, 'utf8')]);

            console.log(`✓ [Telegram Nightly] Successfully sent daily summary & backup to: ${successfulRecipients.join(', ')}`);
            return { success: true, count: successfulRecipients.length, successfulRecipients, failedRecipients };
        } else {
            const errSummary = failedRecipients.join('; ');
            await db.query(`UPDATE Telegram_Backup_Settings SET last_status = 'FAILED', last_error = ? WHERE id = 1`, [errSummary]);
            return { success: false, reason: errSummary };
        }
    } catch (error) {
        console.error('❌ [Telegram Nightly] Dispatch error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Detailed Customer Debts Rollup for Telegram (/debts)
 */
const getDebtSummaryForTelegram = async () => {
    // 1. Customer debt repayments today (قەرزی هاتۆتەوە ئەمڕۆ)
    const [todayPaidRows] = await db.query(`
        SELECT 
            cd.amount,
            cd.note,
            cd.created_at,
            c.name as customer_name
        FROM Customer_Debts cd
        JOIN Customers c ON cd.customer_id = c.id
        WHERE cd.transaction_type = 'PAY' AND DATE(cd.created_at) = CURDATE()
        ORDER BY cd.created_at DESC
    `);
    const todayPaidTotal = todayPaidRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);

    // 2. Customer debt issued today (فرۆشی قەرز ئەمڕۆ)
    const [todayIssuedRows] = await db.query(`
        SELECT 
            cd.amount,
            cd.note,
            cd.created_at,
            c.name as customer_name
        FROM Customer_Debts cd
        JOIN Customers c ON cd.customer_id = c.id
        WHERE cd.transaction_type = 'ADD' AND DATE(cd.created_at) = CURDATE()
        ORDER BY cd.created_at DESC
    `);
    const todayIssuedTotal = todayIssuedRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);

    // 3. Total outstanding debt across all customers in the store
    const [totalOutstanding] = await db.query(`
        SELECT 
            COALESCE(SUM(CASE WHEN transaction_type = 'ADD' THEN amount ELSE -amount END), 0) as total_debt
        FROM Customer_Debts
    `);
    const totalRemainingDebt = Math.max(0, Number(totalOutstanding[0]?.total_debt || 0));

    let msg = `💳 *ڕاپۆرتی قەرزی کڕیاران (ئەمڕۆ)*\n`;
    msg += `📅 *بەروار:* \`${new Date().toISOString().split('T')[0]}\`\n`;
    msg += `⏰ *کات:* ${new Date().toLocaleTimeString('en-GB')}\n\n`;

    msg += `📥 *کۆی قەرزی هاتۆتەوە ئەمڕۆ:* +${todayPaidTotal.toLocaleString()} دینار (${todayPaidRows.length} واسڵکردن)\n`;
    if (todayPaidRows.length > 0) {
        todayPaidRows.slice(0, 10).forEach(r => {
            msg += `   ▫️ ${r.customer_name}: ${Number(r.amount).toLocaleString()} دینار${r.note ? ` (${r.note})` : ''}\n`;
        });
        if (todayPaidRows.length > 10) {
            msg += `   ▫️ ... و ${todayPaidRows.length - 10} کڕیاری تر\n`;
        }
    } else {
        msg += `   (ئەمڕۆ هیچ قەرزێک نەگەڕاوەتەوە)\n`;
    }
    msg += `\n`;

    msg += `📝 *کۆی فرۆشی نوێی قەرز ئەمڕۆ:* ${todayIssuedTotal.toLocaleString()} دینار (${todayIssuedRows.length} کڕین)\n`;
    if (todayIssuedRows.length > 0) {
        todayIssuedRows.slice(0, 5).forEach(r => {
            msg += `   ▫️ ${r.customer_name}: ${Number(r.amount).toLocaleString()} دینار\n`;
        });
    }
    msg += `\n`;

    msg += `💰 *کۆی گشتی قەرزی ماوەی سەر خەڵک (لە سەرەتاوە):* ${totalRemainingDebt.toLocaleString()} دینار`;

    return msg;
};

/**
 * Handle Two-Way Interactive Bot Commands (/today, /backup, /status, /help)
 */
const handleIncomingBotCommand = async (chatId, text, senderName = 'بەڕێز') => {
    const token = await getActiveBotToken();
    const command = (text || '').trim().toLowerCase();

    // Helper to send text message
    const sendReply = async (replyText) => {
        try {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: replyText,
                    parse_mode: 'Markdown'
                }),
                signal: AbortSignal.timeout(10000)
            });
        } catch (_) {}
    };

    if (command === '/today' || command === '/sales' || command === 'فرۆش' || command === 'ئەمڕۆ') {
        const summary = await getDailyFinancialSummary();
        await sendReply(`📊 *کورتەی زیندووی فرۆشی ئەمڕۆ:*\n\n${summary.formattedMessage}`);
    } else if (command === '/debts' || command === '/debt' || command === 'قەرز' || command === 'قەرزەکان') {
        const debtSummary = await getDebtSummaryForTelegram();
        await sendReply(debtSummary);
    } else if (command === '/backup' || command === 'باکئەپ') {
        await sendReply('⏳ خەریکی ئامادەکردنی باکئەپی تەواوی داتابەیسین، تکایە کەمێک چاوەڕوان بە...');
        const { jsonString, totalTables, totalRows } = await buildFullBackupPayload('داواکاری باکئەپ لە ڕێگەی فەرمانی بۆت');
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const filename = `POS_Instant_Backup_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.json`;
        
        try {
            const formData = new FormData();
            formData.append('chat_id', chatId);
            formData.append('caption', `📦 *باکئەپی تەواوی داتابەیس بە سەرکەوتوویی دروستکرا*\n\n📁 ناوی پەڕگە: \`${filename}\`\n📊 خشتەکان: ${totalTables}\n💾 دێڕەکان: ${totalRows}\n📅 کات: ${new Date().toLocaleTimeString('en-GB')}`);
            formData.append('parse_mode', 'Markdown');
            const fileBlob = new Blob([Buffer.from(jsonString, 'utf8')], { type: 'application/json' });
            formData.append('document', fileBlob, filename);

            await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
                method: 'POST',
                body: formData,
                signal: AbortSignal.timeout(45000)
            });
        } catch (err) {
            await sendReply(`❌ نەتوانرا باکئەپ بنێردرێت: ${err.message}`);
        }
    } else if (command === '/status' || command === 'دۆخ') {
        const [shifts] = await db.query(`SELECT * FROM Shifts WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1`);
        const [prodCount] = await db.query(`SELECT COUNT(id) as total_products FROM Products`);
        const statusText = `🏪 *دۆخی سیستەمی مارکێت (POS Status)*
        
🟢 *سێرڤەر:* کارایە و ئۆنلاینە
📦 *کۆی کاڵاکان لە کۆگا:* ${Number(prodCount[0]?.total_products || 0).toLocaleString()} کاڵا
👤 *شیفتی کراوە:* ${shifts.length > 0 ? `${shifts[0].cashier_name} (سەرمایە: ${Number(shifts[0].opening_cash || 0).toLocaleString()} دینار)` : 'هیچ شیفتێک کراوە نییە'}
⏰ *کاتی سێرڤەر:* ${new Date().toLocaleString('en-GB')}`;
        await sendReply(statusText);
    } else if (command === '/help' || command === '/start' || command === 'یارمەتی') {
        const helpText = `🤖 *فەرمانەکانی بۆتی سیستەمی POS*
سڵاو بەڕێز *${senderName}*، دەتوانیت لە ڕێگەی ئەم فەرمانانە سیستەمەکە کۆنتڕۆڵ بکەیت:

📊 /today - نیشاندانی فرۆش، قازانج و قەرزی هاتۆتەوەی ئەمڕۆ
💳 /debts - کورتەی وردی قەرزی کڕیاران و واسڵکردنەکان
📦 /backup - ناردنی دەستبەجێی فایلی باکئەپی داتابەیس
🏪 /status - پشکنینی دۆخی سیستەم و شیفتی کراوە
ℹ️ /help - نیشاندانی ئەم ڕێنماییە

🔔 *تێبینی:* شەوانە کاتژمێر *١١:٥٩* بە شێوەیەکی ئۆتۆماتیکی ڕاپۆرتی کۆتایی ڕۆژ لەگەڵ فایلی تەواوی باکئەپ بۆ ئەم چاتە دەنێردرێت.`;
        await sendReply(helpText);
    }
};

/**
 * Autonomous 23:59:00 Midnight Scheduler
 * Checks every 30 seconds. Fires exactly ONCE per calendar day at 23:59.
 */
let lastBroadcastDate = null;

const checkAndTriggerNightly = async () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Target 23:59 (11:59 PM)
    if (hours === 23 && minutes === 59) {
        if (lastBroadcastDate !== todayStr) {
            console.log(`⏰ [Telegram Nightly] Target time 23:59:00 reached for date: ${todayStr}. Executing automatic closing broadcast...`);
            lastBroadcastDate = todayStr;
            await sendNightlyBackupAndSummary(false);
        }
    }
};

// Start background heartbeat every 30 seconds
setInterval(checkAndTriggerNightly, 30000);

module.exports = {
    getDailyFinancialSummary,
    getDebtSummaryForTelegram,
    sendNightlyBackupAndSummary,
    handleIncomingBotCommand,
    checkAndTriggerNightly
};
