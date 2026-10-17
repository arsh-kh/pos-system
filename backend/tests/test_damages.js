require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');
const damagesController = require('../controllers/damages');

// Mock req and res helper
function mockReqRes(body = {}, query = {}, params = {}, headers = {}) {
    let statusCode = 200;
    let responseData = null;
    const req = {
        body,
        query,
        params,
        headers,
        user: { id: 1, username: 'ئەدمینی تاقیکردنەوە', role: 'ADMIN' },
        ip: '127.0.0.1'
    };
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
    return {
        req,
        res,
        getStatusCode: () => statusCode,
        getData: () => responseData
    };
}

async function runTest() {
    console.log('=== دەستپێکردنی تاقیکردنەوەی تۆمارکردنی زیان و فەوتان (Wastage / Damage Tests) ===');
    let testProductId = null;
    let pieceDamageId = null;
    let boxDamageId = null;

    try {
        // 1. Create a dummy test product
        const [prodResult] = await db.query(`
            INSERT INTO Products (
                name, barcode, cost_price, selling_price, stock, units_per_box, box_barcode
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['کێک و چپس (تاقیکاری زیان)', 'TEST_WASTE_001', 1000, 1500, 50, 12, 'BOX_WASTE_001']);
        testProductId = prodResult.insertId;
        console.log(`✓ کاڵای تاقیکاری دروستکرا: ID #${testProductId} بە 50 دانە مەخزەن و نرخی تێچوون 1000 دینار`);

        // 2. Test Single Piece Damage (2 pieces broken)
        console.log('\n--- تاقیکردنەوەی ١: تۆمارکردنی زیانی ٢ دانەی شکاو ---');
        const pieceTest = mockReqRes({
            product_id: testProductId,
            unit_type: 'PIECE',
            quantity: 2,
            cost_price: 1000,
            reason: 'BROKEN',
            notes: 'لە کاتی بارداگرتن شکا'
        });
        await damagesController.recordDamage(pieceTest.req, pieceTest.res);
        const pieceResData = pieceTest.getData();

        if (pieceTest.getStatusCode() !== 201 || pieceResData.status !== 'SUCCESS') {
            throw new Error(`شکستی تۆمارکردنی زیانی دانە: ${JSON.stringify(pieceResData)}`);
        }
        pieceDamageId = pieceResData.data.damage_id;

        // Check stock in DB
        const [p1] = await db.query('SELECT stock FROM Products WHERE id = ?', [testProductId]);
        console.log(`مەخزەن دوای تۆمارکردنی ٢ دانە زیان: ${p1[0].stock} دانە (دابەزی لە 50 بۆ 48)`);
        if (Number(p1[0].stock) !== 48) {
            throw new Error(`مەخزەن هەڵەیە! چاوەڕوانکراو 48، بەڵام ${p1[0].stock}`);
        }
        if (pieceResData.data.total_cost_loss !== 2000) {
            throw new Error(`بڕی زیان هەڵەیە! چاوەڕوانکراو 2000، بەڵام ${pieceResData.data.total_cost_loss}`);
        }
        console.log(`✓ زیانی دانە بە سەرکەوتوویی تۆمارکرا بە بڕی زیانی ${pieceResData.data.total_cost_loss} دینار`);

        // 3. Test Carton/Box Damage (1 box expired)
        console.log('\n--- تاقیکردنەوەی ٢: تۆمارکردنی زیانی ١ کارتۆنی بەسەرچوو (١٢ دانە) ---');
        const boxTest = mockReqRes({
            product_id: testProductId,
            unit_type: 'BOX',
            quantity: 1,
            cost_price: 1000,
            reason: 'EXPIRED',
            notes: 'بەروارەکەی مانگی پێشوو بووە'
        });
        await damagesController.recordDamage(boxTest.req, boxTest.res);
        const boxResData = boxTest.getData();

        if (boxTest.getStatusCode() !== 201 || boxResData.status !== 'SUCCESS') {
            throw new Error(`شکستی تۆمارکردنی زیانی کارتۆن: ${JSON.stringify(boxResData)}`);
        }
        boxDamageId = boxResData.data.damage_id;

        const [p2] = await db.query('SELECT stock FROM Products WHERE id = ?', [testProductId]);
        console.log(`مەخزەن دوای تۆمارکردنی ١ کارتۆن: ${p2[0].stock} دانە (١٢ دانە کەمبوویەوە، بوو بە 36)`);
        if (Number(p2[0].stock) !== 36) {
            throw new Error(`مەخزەن هەڵەیە! چاوەڕوانکراو 36، بەڵام ${p2[0].stock}`);
        }
        if (boxResData.data.total_cost_loss !== 12000) {
            throw new Error(`بڕی زیان هەڵەیە! چاوەڕوانکراو 12000، بەڵام ${boxResData.data.total_cost_loss}`);
        }
        console.log(`✓ زیانی کارتۆن بە سەرکەوتوویی تۆمارکرا بە بڕی زیانی ${boxResData.data.total_cost_loss} دینار`);

        // 4. Test Damage Stats
        console.log('\n--- تاقیکردنەوەی ٣: پشکنینی ئاماری زیانەکان (Stats) ---');
        const statsTest = mockReqRes({}, {}, {});
        await damagesController.getDamagesStats(statsTest.req, statsTest.res);
        const statsData = statsTest.getData();
        console.log(`کۆی زیانی ئەم مانگە: ${Number(statsData.data.this_month.this_month_loss).toLocaleString()} دینار`);
        console.log(`کۆی دانەی فەوتاوی ئەم مانگە: ${statsData.data.this_month.this_month_units} دانە`);
        if (Number(statsData.data.this_month.this_month_loss) < 14000) {
            throw new Error('کۆی زیانی مانگانە کەمترە لە چاوەڕوانکراو!');
        }
        console.log('✓ پشکنینی ئاماری زیانەکان بە سەرکەوتوویی تێپەڕی');

        // 5. Test Revert / Delete Damage Record
        console.log('\n--- تاقیکردنەوەی ٤: گەڕاندنەوە / هەڵوەشاندنەوەی زیان لە کاتی هەڵەدا ---');
        const deleteTest = mockReqRes({}, {}, { id: boxDamageId });
        await damagesController.deleteDamageRecord(deleteTest.req, deleteTest.res);
        const deleteData = deleteTest.getData();
        if (deleteData.status !== 'SUCCESS') {
            throw new Error(`شکست لە سڕینەوەی زیان: ${JSON.stringify(deleteData)}`);
        }

        const [p3] = await db.query('SELECT stock FROM Products WHERE id = ?', [testProductId]);
        console.log(`مەخزەن دوای گەڕاندنەوەی زیانی کارتۆنەکە: ${p3[0].stock} دانە (گەڕایەوە بۆ 48)`);
        if (Number(p3[0].stock) !== 48) {
            throw new Error(`مەخزەن نەگەڕایەوە سەر ژمارەی دروست! 48 بوو بە ${p3[0].stock}`);
        }
        console.log('✓ سڕینەوە و گەڕاندنەوەی کۆگا بە سەرکەوتوویی تێپەڕی');

        console.log('\n=== هەموو تاقیکردنەوەکانی باکئێندی زیان و فەوتان ١٠٠٪ سەرکەوتوو بوون! ===');

    } catch (err) {
        console.error('❌ هەڵە لە تاقیکردنەوە:', err.message);
        process.exit(1);
    } finally {
        // Clean up test data
        console.log('\n--- پاککردنەوەی داتای تاقیکاری ---');
        if (pieceDamageId) await db.query('DELETE FROM Damages WHERE id = ?', [pieceDamageId]);
        if (boxDamageId) await db.query('DELETE FROM Damages WHERE id = ?', [boxDamageId]);
        if (testProductId) await db.query('DELETE FROM Products WHERE id = ?', [testProductId]);
        console.log('✓ داتای تاقیکاری بە خاوێنی سڕدرایەوە.');
        process.exit(0);
    }
}

runTest();
