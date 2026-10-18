const db = require('../db');

const DEFAULT_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8928798854:AAGlhCrK1qmBVTbNKlya71WBv_cERTbdX14';

async function getBotToken() {
    try {
        const [rows] = await db.query('SELECT bot_token FROM Telegram_Backup_Settings WHERE id = 1');
        if (rows.length > 0 && rows[0].bot_token && rows[0].bot_token.trim()) {
            return rows[0].bot_token.trim();
        }
    } catch (_) {}
    return DEFAULT_BOT_TOKEN;
}

/**
 * Send a formatted message to all active Telegram recipients
 */
async function sendTelegramBroadcast(text, parseMode = 'Markdown') {
    try {
        const [recipients] = await db.query('SELECT chat_id, recipient_name as name FROM Telegram_Recipients WHERE is_active = 1');
        if (!recipients || recipients.length === 0) {
            return { success: false, reason: 'NO_RECIPIENTS' };
        }

        const token = await getBotToken();
        const results = [];

        for (const recipient of recipients) {
            try {
                const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: recipient.chat_id,
                        text: text,
                        parse_mode: parseMode
                    })
                });
                const data = await res.json();
                results.push({ chat_id: recipient.chat_id, ok: data.ok });
            } catch (err) {
                results.push({ chat_id: recipient.chat_id, ok: false, error: err.message });
            }
        }

        return { success: true, count: results.filter(r => r.ok).length, results };
    } catch (err) {
        console.error('sendTelegramBroadcast Error:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Format and send Shift Closure Z-Report
 */
async function sendShiftZReportTelegram(zData) {
    const diff = Number(zData.difference || 0);
    const diffText = diff === 0 
        ? '✅ یەکسانە و بێ کەموکوڕییە' 
        : (diff > 0 ? `🔺 زیادە لە قاسە: +${diff.toLocaleString()} دینار` : `🔻 کورتە لە قاسە: ${diff.toLocaleString()} دینار`);

    const msg = `🏪 *ڕاپۆرتی داخستنی شیفت (Z-Report)*

👤 *کاشێر:* ${zData.cashier_name || 'کاشێری سەرەکی'}
🆔 *ژمارەی شیفت:* #${zData.shift_id || zData.id || 1}
📅 *بەرواری داخستن:* ${new Date().toLocaleString('en-GB')}

💵 *فرۆشی نەقد (کاش):* ${Number(zData.cash_sales || 0).toLocaleString()} دینار
📝 *فرۆشی قەرز:* ${Number(zData.debt_sales || 0).toLocaleString()} دینار
💰 *کۆی گشتی فرۆش:* ${Number(zData.total_sales || 0).toLocaleString()} دینار

📥 *گەڕاوەی نەقد:* -${Number(zData.cash_refunds || 0).toLocaleString()} دینار
📉 *خەرجییەکان:* -${Number(zData.expenses_paid || 0).toLocaleString()} دینار
🪙 *سەرمایەی سەرەتا:* ${Number(zData.opening_cash || 0).toLocaleString()} دینار

📊 *پێشبینیکراو لە قاسە:* ${Number(zData.expected_cash || 0).toLocaleString()} دینار
💵 *ژمێردراوی دەستی:* ${Number(zData.actual_cash || zData.expected_cash || 0).toLocaleString()} دینار
⚖️ *دۆخی قاسە:* ${diffText}
${zData.notes ? `\n📝 *تێبینی:* ${zData.notes}` : ''}
`;

    return await sendTelegramBroadcast(msg);
}

module.exports = {
    sendTelegramBroadcast,
    sendShiftZReportTelegram
};
