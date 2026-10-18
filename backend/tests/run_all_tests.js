const { execSync } = require('child_process');
const path = require('path');

const testFiles = [
    'test_database_integrity.js',
    'test_checkout_fuzz_scenarios.js',
    'test_inventory_fifo_landed_cost.js',
    'test_credit_debt_engine.js',
    'test_audit_comprehensive_fixes.js',
    'test_smart_returns.js',
    'test_fifo_profit.js',
    'test_damages.js',
    'test_inventory_audit.js',
    'test_rtv_vendor_returns.js',
    'test_split_payment.js',
    'test_sync_engine.js',
    'test_backup_restore.js',
    'test_telegram_backup.js',
    'test_month_over_month_analytics.js',
    'test_auth_security.js',
    'test_hardware_escpos.js',
    'test_z_report_and_telegram.js',
    'test_telegram_nightly.js',
    'test_cashier_permissions.js',
    'test_full_lifecycle_e2e.js',
    'test_analytics_ranges.js',
    'test_multi_cashier_and_audit.js',
    'test_date_formatter.js'
];

async function runMasterSuite() {
    console.log('========================================================================');
    console.log('🚀 دەستپێکردنی ڕەنەری گشتگیری هەموو تاقیکردنەوەکان (Master Test Runner)');
    console.log('========================================================================\n');

    const results = [];
    let allPassed = true;

    for (let i = 0; i < testFiles.length; i++) {
        const file = testFiles[i];
        const filePath = path.resolve(__dirname, file);
        process.stdout.write(`[${i + 1}/${testFiles.length}] تاقیکردنەوەی ${file}... `);

        const startTime = Date.now();
        try {
            execSync(`node "${filePath}"`, {
                cwd: path.resolve(__dirname, '../..'),
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: 30000
            });
            const duration = Date.now() - startTime;
            console.log(`✓ سەرکەوتوو (${duration}ms)`);
            results.push({ file, status: 'PASSED', duration: `${duration}ms` });
        } catch (err) {
            const duration = Date.now() - startTime;
            console.log(`❌ شکستی هێنا (${duration}ms)`);
            results.push({ file, status: 'FAILED', duration: `${duration}ms`, error: err.message });
            allPassed = false;
        }
    }

    console.log('\n========================================================================');
    console.log('📊 خشتەی کۆتایی ئەنجامی هەموو تاقیکردنەوەکان');
    console.log('========================================================================');
    console.table(results);

    if (allPassed) {
        console.log(`\n🎉 پیرۆزە! هەموو ${testFiles.length} تاقیکردنەوەکە بە ڕێژەی ١٠٠٪ سەرکەوتوون!`);
        process.exit(0);
    } else {
        console.error('\n⚠️ هەندێک لە تاقیکردنەوەکان سەرکەوتوو نەبوون!');
        process.exit(1);
    }
}

runMasterSuite();
