const assert = require('assert');
const db = require('../db');
const analyticsController = require('../controllers/analytics');

async function runTest() {
    console.log('--- دەستپێکردنی تاقیکردنەوەی ئاماری دارایی و بەراوردی مانگانە (Month-over-Month Analytics Test) ---');

    // Mock Express req & res
    const req = {};
    let responseData = null;
    let statusCode = 200;

    const res = {
        status: (code) => {
            statusCode = code;
            return res;
        },
        json: (data) => {
            responseData = data;
            return res;
        }
    };

    // 1. Call getDashboardStats
    await analyticsController.getDashboardStats(req, res);

    assert.strictEqual(statusCode, 200, 'Endpoint should return HTTP 200');
    assert.strictEqual(responseData.status, 'SUCCESS', 'Response status should be SUCCESS');
    assert(responseData.data, 'Response should contain data object');
    assert(responseData.data.current_month, 'Data should contain current_month');

    const cm = responseData.data.current_month;

    // 2. Validate essential financial fields exist
    console.log('✓ دڵنیابوونەوە لە بوونی کێڵگە داراییە سەرەکییەکان:');
    assert(cm.hasOwnProperty('total_sales'), 'Must include total_sales');
    assert(cm.hasOwnProperty('last_month_sales'), 'Must include last_month_sales');
    assert(cm.hasOwnProperty('gross_profit'), 'Must include gross_profit');
    assert(cm.hasOwnProperty('total_expenses'), 'Must include total_expenses');
    assert(cm.hasOwnProperty('total_damages_loss'), 'Must include total_damages_loss');
    assert(cm.hasOwnProperty('net_profit'), 'Must include net_profit');

    console.log(`  - کۆی فرۆشتنی ئەم مانگە: ${Number(cm.total_sales).toLocaleString()} دینار`);
    console.log(`  - کۆی فرۆشتنی مانگی ڕابردوو (بۆ بەراورد): ${Number(cm.last_month_sales).toLocaleString()} دینار`);
    console.log(`  - قازانجی سافی ڕاستەقینە: ${Number(cm.net_profit).toLocaleString()} دینار`);

    // 3. Verify Net Profit Logic: Net Profit = Adjusted Gross Profit - Expenses - Damages Loss
    const calculatedNetProfit = Number(cm.gross_profit) - Number(cm.total_expenses) - Number(cm.total_damages_loss);
    assert.strictEqual(Number(cm.net_profit), calculatedNetProfit, 'Net profit formula must match exactly');
    console.log('✓ هاوکێشەی قازانجی سافی (Net Profit) بە تەواوی ڕاستە: Gross Profit - Expenses - Damages');

    console.log('🎉 تاقیکردنەوەی ئاماری مانگانە و Month-over-Month بە سەرکەوتوویی تێپەڕی!');
}

runTest()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('❌ هەڵە لە تاقیکردنەوە:', err);
        process.exit(1);
    });
