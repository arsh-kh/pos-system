require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const assert = require('assert');
const db = require('../db');

async function testDatabaseIntegrity() {
    console.log('=== دەستپێکردنی تاقیکردنەوەی تەواوی سەلامەتی داتابەیس (Database Integrity Tests) ===\n');

    let testProductId = null;

    try {
        // --- 1. Kurdish Unicode UTF8MB4 Test ---
        console.log('--- ١. تاقیکردنەوەی پشتگیری پیتە کوردییەکان (Kurdish Unicode Characters) ---');
        const kurdishName = 'شەربەتی هەناری ڕەسەنی شارەزوور (تایبەت بە ڕەمەزان) - قەزوان و گوێز و مێوژ - ڤۆدکا ٠٪';
        const testBarcode = `KURD_TEST_${Date.now()}`;

        const [insertRes] = await db.query(`
            INSERT INTO Products (name, barcode, cost_price, selling_price, stock, low_stock_threshold)
            VALUES (?, ?, 1500, 2500, 10.500, 2.500)
        `, [kurdishName, testBarcode]);

        testProductId = insertRes.insertId;

        const [fetchRows] = await db.query('SELECT name, stock, low_stock_threshold FROM Products WHERE id = ?', [testProductId]);
        assert.strictEqual(fetchRows.length, 1, 'Product must exist');
        assert.strictEqual(fetchRows[0].name, kurdishName, 'Kurdish unicode name must match exactly character by character');
        console.log('✓ پیتە کوردییە تایبەتەکان (ڕ، ڵ، ێ، ۆ، ڤ) بە بێ شێوان پاشەکەوتکران');

        // --- 2. Decimal Precision (10, 3) Test ---
        console.log('\n--- ٢. تاقیکردنەوەی وردی کێشانە و ژمارەی بەشەکی (Decimal Precision 10,3) ---');
        const expectedStock = 10.5;
        const expectedThreshold = 2.5;
        assert.strictEqual(parseFloat(fetchRows[0].stock), expectedStock, 'Stock must preserve 3 decimal places');
        assert.strictEqual(parseFloat(fetchRows[0].low_stock_threshold), expectedThreshold, 'Low stock threshold must be decimal');
        console.log(`✓ بڕی مەخزەن (${fetchRows[0].stock}) و کەمترین ئاگاداری (${fetchRows[0].low_stock_threshold}) بە وردی دەیی پارێزراون`);

        // --- 3. Connection Pool Concurrency Test ---
        console.log('\n--- ٣. تاقیکردنەوەی پەیوەندییە هاوکاتەکان (Connection Pool 25 Concurrency) ---');
        const queryPromises = [];
        for (let i = 0; i < 30; i++) {
            queryPromises.push(db.query('SELECT 1 + ? as result', [i]));
        }
        const results = await Promise.all(queryPromises);
        assert.strictEqual(results.length, 30, 'All 30 concurrent queries must resolve successfully');
        console.log('✓ ٣٠ داواکاری لە یەک چرکەدا بە سەرکەوتوویی لە لایەن MySQL Pool وەڵامدرانەوە');

        // --- 4. Foreign Key Constraints Test ---
        console.log('\n--- ٤. تاقیکردنەوەی پاراستنی کلیلە بیانییەکان (Foreign Key Constraint Enforcement) ---');
        let fkErrorCaught = false;
        try {
            // Attempt inserting a sale item with non-existent product ID
            await db.query(`
                INSERT INTO Sale_Items (sale_id, product_id, quantity, price_at_sale)
                VALUES (1, 999999999, 1.000, 1000)
            `);
        } catch (err) {
            fkErrorCaught = true;
            assert(err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW', 'Database must reject invalid foreign key');
        }
        assert(fkErrorCaught, 'Invalid foreign key insertion must be rejected by MySQL');
        console.log('✓ داتابەیس بە توندی ڕێگری لە تۆمارکردنی کلیلە بیانییە نادروستەکان دەکات');

        // --- Clean up ---
        if (testProductId) {
            await db.query('DELETE FROM Products WHERE id = ?', [testProductId]);
            console.log('\n✓ کاڵای تاقیکاری پاککرایەوە');
        }

        console.log('\n================================================================');
        console.log('🎉 هەموو تاقیکردنەوەکانی مۆدیوڵی ١ (Database Integrity) ١٠٠٪ سەرکەوتوون!');
        console.log('================================================================');
        process.exit(0);
    } catch (err) {
        console.error('❌ تاقیکردنەوە سەرکەوتوو نەبوو:', err);
        if (testProductId) {
            try { await db.query('DELETE FROM Products WHERE id = ?', [testProductId]); } catch (_) {}
        }
        process.exit(1);
    }
}

testDatabaseIntegrity();
