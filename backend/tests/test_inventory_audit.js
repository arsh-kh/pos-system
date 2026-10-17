require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');
const auditController = require('../controllers/inventory_audit');

function mockReqRes(body = {}, query = {}, params = {}) {
    let statusCode = 200;
    let responseData = null;
    const req = {
        body,
        query,
        params,
        user: { id: 1, username: 'خاوەنکار (ئەدمین)', role: 'ADMIN' },
        headers: { 'x-user-name': 'خاوەنکار (ئەدمین)' },
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
    console.log('=== دەستپێکردنی تاقیکردنەوەی جەردکردنی زیرەک (Smart Inventory Audit Tests) ===');
    let testProductId = null;
    let auditRecordId = null;
    let damageId = null;

    try {
        // 1. Create Test Product: "تایگەر" with 50 units in stock and cost 1000 IQD
        const [prodRes] = await db.query(`
            INSERT INTO Products (name, barcode, cost_price, selling_price, stock, units_per_box)
            VALUES (?, ?, ?, ?, ?, ?)
        `, ['خواردنەوەی وزەبەخشی تایگەر', 'TIGER_ENERGY_001', 1000, 1500, 50, 24]);
        testProductId = prodRes.insertId;
        console.log(`✓ کاڵای تاقیکاری دروستکرا: "تایگەر" (ID #${testProductId}) بە ٥٠ دانە لە مەخزەن و نرخی تێچوون ١،٠٠٠ د.ع`);

        // 2. Test 1: Physical count is 48 (2 units missing / shortage)
        console.log('\n--- تاقیکردنەوەی ١: جەردکردنی ساردکەرەوە (بینینی ٤٨ دانە لەبری ٥٠) ---');
        const countTest = mockReqRes({
            product_id: testProductId,
            counted_stock: 48,
            unit_type: 'PIECE',
            notes: 'ساردکەرەوەی پێشەوە: ٢ دانە نوقسانی هەبوو'
        });
        await auditController.reconcileProductStock(countTest.req, countTest.res);
        const resData = countTest.getData();

        if (countTest.getStatusCode() !== 200 || resData.status !== 'SUCCESS') {
            throw new Error(`شکستی جەردکردن: ${JSON.stringify(resData)}`);
        }
        auditRecordId = resData.data.audit_id;
        damageId = resData.data.damage_id;

        // Verify stock updated to 48
        const [p1] = await db.query('SELECT stock FROM Products WHERE id = ?', [testProductId]);
        console.log(`مەخزەنی تایگەر دوای جەرد: ${p1[0].stock} دانە (ڕاستکرایەوە بۆ ٤٨)`);
        if (Number(p1[0].stock) !== 48) {
            throw new Error(`مەخزەن هەڵەیە! دەبوو ببێتە 48، بەڵام ${p1[0].stock}`);
        }

        // Verify Damage record created
        if (!damageId) {
            throw new Error('تۆماری زیان لە Damages دروست نەبوو لە کاتی نوقسانیدا!');
        }
        const [d1] = await db.query('SELECT * FROM Damages WHERE id = ?', [damageId]);
        if (d1.length === 0) {
            throw new Error('تۆماری زیان لە داتابەیسدا نەدۆزرایەوە!');
        }
        console.log(`✓ تۆماری زیان لە Damages دروستبوو: بڕ = ${d1[0].quantity} دانە، زەرەری دارایی = ${d1[0].total_cost_loss} دینار`);
        if (Number(d1[0].quantity) !== 2 || Number(d1[0].total_cost_loss) !== 2000) {
            throw new Error(`زانیاری زیان هەڵەیە! چاوەڕوانکراو ٢ دانە و ٢٠٠٠ دینار، بەڵام بڕ=${d1[0].quantity}، زەرەر=${d1[0].total_cost_loss}`);
        }
        console.log('✓ نوقسانی ٢ دانە تایگەرەکە (٢،٠٠٠ دینار) ڕاستەوخۆ چووە سەر لیستی زیانەکانی مانگ بۆ دەرکردن لە قازانج');

        // 3. Test 2: Exact Match
        console.log('\n--- تاقیکردنەوەی ٢: پشکنینی کاڵای هاوتا (Exact Match) ---');
        const matchTest = mockReqRes({
            product_id: testProductId,
            counted_stock: 48,
            unit_type: 'PIECE',
            notes: 'پشکنینەوە: هاوتایە'
        });
        await auditController.reconcileProductStock(matchTest.req, matchTest.res);
        const matchData = matchTest.getData();
        if (matchData.data.status !== 'MATCH' || matchData.data.damage_id !== null) {
            throw new Error('دۆخی هاوتا هەڵەیە یان زیانی بۆ دروستبووە!');
        }
        console.log('✓ کاڵای هاوتا بە سەرکەوتوویی بە MATCH تۆمارکرا بێ دروستکردنی هیچ زیانێک');

        // 4. Test 3: Surplus (+2 surplus)
        console.log('\n--- تاقیکردنەوەی ٣: پشکنینی زیادەی کاڵا (+2 زیادە) ---');
        const surplusTest = mockReqRes({
            product_id: testProductId,
            counted_stock: 50,
            unit_type: 'PIECE',
            notes: 'زیادە دۆزرایەوە لە مەخزەنی سەرەوە'
        });
        await auditController.reconcileProductStock(surplusTest.req, surplusTest.res);
        const surplusData = surplusTest.getData();
        const [p2] = await db.query('SELECT stock FROM Products WHERE id = ?', [testProductId]);
        console.log(`مەخزەن دوای تۆمارکردنی زیادە: ${p2[0].stock} دانە (بوو بە ٥٠)`);
        if (Number(p2[0].stock) !== 50 || surplusData.data.status !== 'SURPLUS') {
            throw new Error('زیادەی کاڵا بە دروستی ئەنجام نەدرا!');
        }
        console.log('✓ زیادەی کاڵا بە سەرکەوتوویی بە SURPLUS تۆمارکرا و مەخزەن زیادبوو');

        // 5. Test 4: Revert Audit
        console.log('\n--- تاقیکردنەوەی ٤: هەڵوەشاندنەوەی جەرد و گەڕانەوەی مەخزەن و سڕینەوەی زیان ---');
        const revertTest = mockReqRes({}, {}, { id: auditRecordId });
        await auditController.revertAudit(revertTest.req, revertTest.res);
        const [dCheck] = await db.query('SELECT * FROM Damages WHERE id = ?', [damageId]);
        if (dCheck.length > 0) {
            throw new Error('لە کاتی هەڵوەشاندنەوەی جەرد، تۆماری زیانەکە لە Damages نەستڕایەوە!');
        }
        console.log('✓ لە کاتی هەڵوەشاندنەوەی جەردەکە، تۆماری زیانەکەش بە خاوێنی سڕدرایەوە');

        console.log('\n=== هەموو تاقیکردنەوەکانی جەردکردنی زیرەک ١٠٠٪ بە سەرکەوتوویی تەواو بوون! ===');

    } catch (err) {
        console.error('❌ هەڵە لە تاقیکردنەوە:', err.message);
        process.exit(1);
    } finally {
        console.log('\n--- پاککردنەوەی داتای تاقیکاری ---');
        if (testProductId) {
            await db.query('DELETE FROM Inventory_Audits WHERE product_id = ?', [testProductId]);
            await db.query('DELETE FROM Damages WHERE product_id = ?', [testProductId]);
            await db.query('DELETE FROM Products WHERE id = ?', [testProductId]);
        }
        console.log('✓ داتای تاقیکاری بە خاوێنی سڕدرایەوە.');
        process.exit(0);
    }
}

runTest();
