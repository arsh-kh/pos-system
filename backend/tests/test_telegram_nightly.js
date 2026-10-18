require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const assert = require('assert');
const { getDailyFinancialSummary, handleIncomingBotCommand } = require('../services/telegramNightlyScheduler');
const db = require('../db');

async function runTest() {
    console.log('--- 🧪 تاقیکردنەوەی خزمەتگوزاری کۆتایی ڕۆژ و بۆتی تێلیگرام (Testing Nightly Summary & Bot Commands) ---');

    try {
        // 1. Test Daily Financial Rollup
        console.log('1️⃣ تاقیکردنەوەی حیساباتی کۆتایی ڕۆژ (Daily Financial Summary Calculation)...');
        const summary = await getDailyFinancialSummary();
        assert(summary !== null, 'Summary should not be null');
        assert(typeof summary.totalSales === 'number', 'totalSales must be a number');
        assert(typeof summary.netProfit === 'number', 'netProfit must be a number');
        assert(typeof summary.formattedMessage === 'string', 'formattedMessage must be string');
        assert(summary.formattedMessage.includes('کورتەی فرۆش و دارایی ڕۆژانە'), 'Message must contain Kurdish title');
        console.log('✓ حیساباتی دارایی سەرکەوتوو بوو:');
        console.log(`   - کۆی فرۆش: ${summary.totalSales.toLocaleString()} دینار`);
        console.log(`   - پسوولەکان: ${summary.totalInvoices}`);
        console.log(`   - قازانجی خاوێن: ${summary.netProfit.toLocaleString()} دینار`);

        // 2. Test Bot Command Handler for /status
        console.log('2️⃣ تاقیکردنەوەی کاردانەوەی فەرمانی بۆت (/status & /help)...');
        // Test that handleIncomingBotCommand does not throw
        await handleIncomingBotCommand('1796577602', '/help', 'Yaras');
        console.log('✓ فەرمانی /help بە سەرکەوتوویی جێبەجێکرا.');

        // 3. Test Active Recipients in DB
        const [recipients] = await db.query('SELECT * FROM Telegram_Recipients WHERE is_active = TRUE');
        console.log(`3️⃣ پشکنینی وەرگرە چالاکەکانی داتابەیس: ${recipients.length} وەرگری چالاک بوونی هەیە.`);
        assert(recipients.length > 0, 'Should have at least 1 active recipient');

        console.log('\n🎉 هەموو پشکنینەکانی خزمەتگوزاری تێلیگرام بە سەرکەوتوویی دەرچوون (ALL NIGHTLY BOT TESTS PASSED)!');
        process.exit(0);
    } catch (err) {
        console.error('❌ تاقیکردنەوە سەرکەوتوو نەبوو:', err);
        process.exit(1);
    }
}

runTest();
