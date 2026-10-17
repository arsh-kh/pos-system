require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');
const rtvController = require('../controllers/purchase_returns');

function mockReqRes(body = {}, query = {}, params = {}) {
    let statusCode = 200;
    let responseData = null;
    const req = {
        body,
        query,
        params,
        user: { id: 1, username: 'ئەدمینی تاقیکاری', role: 'ADMIN' },
        headers: { 'x-user-name': 'ئەدمینی تاقیکاری' },
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
    console.log('=== دەستپێکردنی تاقیکردنەوەی گەڕاندنەوە بۆ کۆمپانیا (RTV Tests) ===');
    let testSupplierId = null;
    let testProductId = null;
    let pieceReturnId = null;
    let boxReturnId = null;

    try {
        // 1. Create Test Supplier
        const [supRes] = await db.query(`
            INSERT INTO Suppliers (name, phone, total_paid, total_remaining)
            VALUES (?, ?, ?, ?)
        `, ['کۆمپانیای خۆراکی تاقیکاری', '07501234567', 0, 100000]);
        testSupplierId = supRes.insertId;
        console.log(`✓ کۆمپانیای تاقیکاری دروستکرا: ID #${testSupplierId} بە قەرزی ١٠٠،٠٠٠ دینار لای مارکێت`);

        // 2. Create Test Product
        const [prodRes] = await db.query(`
            INSERT INTO Products (name, barcode, cost_price, selling_price, stock, units_per_box, box_barcode)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['شەربەتی تاقیکاری RTV', 'RTV_PROD_001', 2000, 2500, 60, 10, 'BOX_RTV_001']);
        testProductId = prodRes.insertId;
        console.log(`✓ کاڵای تاقیکاری دروستکرا: ID #${testProductId} بە مەخزەنی 60 دانە و تێچوونی 2000 دینار`);

        // 3. Test 1: Return 5 Pieces with Debt Deduction
        console.log('\n--- تاقیکردنەوەی ١: گەڕاندنەوەی ٥ دانە بە مەندوب (داشکاندن لە قەرزی کۆمپانیا) ---');
        const pieceTest = mockReqRes({
            supplier_id: testSupplierId,
            product_id: testProductId,
            unit_type: 'PIECE',
            quantity: 5,
            cost_price: 2000,
            refund_type: 'DEBT_DEDUCT',
            reason: 'بەسەردەچوونی بەروار',
            representative_name: 'کاک کاروان (مەندوب)',
            notes: 'بەروارەکەی هەفتەی پێشوو تەواوبوو'
        });
        await rtvController.createPurchaseReturn(pieceTest.req, pieceTest.res);
        const pieceData = pieceTest.getData();

        if (pieceTest.getStatusCode() !== 201 || pieceData.status !== 'SUCCESS') {
            throw new Error(`شکستی گەڕاندنەوەی دانە: ${JSON.stringify(pieceData)}`);
        }
        pieceReturnId = pieceData.returnId;

        // Verify stock
        const [p1] = await db.query('SELECT stock FROM Products WHERE id = ?', [testProductId]);
        console.log(`مەخزەن دوای گەڕاندنەوەی ٥ دانە: ${p1[0].stock} (دابەزی لە 60 بۆ 55)`);
        if (Number(p1[0].stock) !== 55) {
            throw new Error(`مەخزەن هەڵەیە! چاوەڕوانکراو 55، بەڵام ${p1[0].stock}`);
        }

        // Verify supplier debt
        const [s1] = await db.query('SELECT total_remaining FROM Suppliers WHERE id = ?', [testSupplierId]);
        console.log(`قەرزی کۆمپانیا دوای گەڕاندنەوەی ٥ دانە: ${s1[0].total_remaining} دینار (کەمبوویەوە لە 100,000 بۆ 90,000)`);
        if (Number(s1[0].total_remaining) !== 90000) {
            throw new Error(`قەرزی کۆمپانیا هەڵەیە! چاوەڕوانکراو 90000، بەڵام ${s1[0].total_remaining}`);
        }
        console.log('✓ گەڕاندنەوەی دانە بە سەرکەوتوویی لە مەخزەن دەرچوو و لە قەرزی کۆمپانیا داشکێندرا');

        // 4. Test 2: Return 1 Carton (Box of 10 units)
        console.log('\n--- تاقیکردنەوەی ٢: گەڕاندنەوەی ١ کارتۆن (١٠ دانە) بۆ مەندوب ---');
        const boxTest = mockReqRes({
            supplier_id: testSupplierId,
            product_id: testProductId,
            unit_type: 'BOX',
            quantity: 1,
            cost_price: 2000,
            refund_type: 'DEBT_DEDUCT',
            reason: 'تێکچوون لە کارگە',
            representative_name: 'کاک کاروان (مەندوب)',
            notes: 'کارتۆنەکە لێچوونی هەبوو'
        });
        await rtvController.createPurchaseReturn(boxTest.req, boxTest.res);
        const boxData = boxTest.getData();

        if (boxTest.getStatusCode() !== 201 || boxData.status !== 'SUCCESS') {
            throw new Error(`شکستی گەڕاندنەوەی کارتۆن: ${JSON.stringify(boxData)}`);
        }
        boxReturnId = boxData.returnId;

        // Verify stock
        const [p2] = await db.query('SELECT stock FROM Products WHERE id = ?', [testProductId]);
        console.log(`مەخزەن دوای گەڕاندنەوەی ١ کارتۆن: ${p2[0].stock} (١٠ دانە دابەزی لە 55 بۆ 45)`);
        if (Number(p2[0].stock) !== 45) {
            throw new Error(`مەخزەن هەڵەیە! چاوەڕوانکراو 45، بەڵام ${p2[0].stock}`);
        }

        // Verify supplier debt
        const [s2] = await db.query('SELECT total_remaining FROM Suppliers WHERE id = ?', [testSupplierId]);
        console.log(`قەرزی کۆمپانیا دوای گەڕاندنەوەی کارتۆن: ${s2[0].total_remaining} دینار (کەمبوویەوە لە 90,000 بۆ 70,000)`);
        if (Number(s2[0].total_remaining) !== 70000) {
            throw new Error(`قەرزی کۆمپانیا هەڵەیە! چاوەڕوانکراو 70000، بەڵام ${s2[0].total_remaining}`);
        }
        console.log('✓ گەڕاندنەوەی کارتۆن ١٠ دانەی لە مەخزەن دەرکرد و ٢٠،٠٠٠ دیناری لە قەرزی کۆمپانیا کەمکردەوە');

        // 5. Test 3: Revert / Delete Box Return
        console.log('\n--- تاقیکردنەوەی ٣: هەڵوەشاندنەوەی گەڕاندنەوە و بووژانەوەی قەرز و کۆگا ---');
        const deleteTest = mockReqRes({}, {}, { id: boxReturnId });
        await rtvController.deletePurchaseReturn(deleteTest.req, deleteTest.res);
        const delData = deleteTest.getData();

        if (delData.status !== 'SUCCESS') {
            throw new Error(`شکست لە هەڵوەشاندنەوە: ${JSON.stringify(delData)}`);
        }

        const [p3] = await db.query('SELECT stock FROM Products WHERE id = ?', [testProductId]);
        const [s3] = await db.query('SELECT total_remaining FROM Suppliers WHERE id = ?', [testSupplierId]);
        console.log(`مەخزەن دوای هەڵوەشاندنەوە: ${p3[0].stock} (گەڕایەوە بۆ 55)`);
        console.log(`قەرزی کۆمپانیا دوای هەڵوەشاندنەوە: ${s3[0].total_remaining} دینار (گەڕایەوە بۆ 90,000)`);

        if (Number(p3[0].stock) !== 55 || Number(s3[0].total_remaining) !== 90000) {
            throw new Error('هەڵوەشاندنەوە سەرکەوتوو نەبوو لە گەڕاندنەوەی تەواوی کۆگا و باڵانس');
        }
        console.log('✓ هەڵوەشاندنەوە بە سەرکەوتوویی تێپەڕی');

        console.log('\n=== هەموو تاقیکردنەوەکانی RTV ١٠٠٪ بە سەرکەوتوویی تەواو بوون! ===');

    } catch (err) {
        console.error('❌ هەڵە لە تاقیکردنەوە:', err.message);
        process.exit(1);
    } finally {
        console.log('\n--- پاککردنەوەی داتای تاقیکاری ---');
        if (pieceReturnId) await db.query('DELETE FROM Purchase_Returns WHERE id = ?', [pieceReturnId]);
        if (boxReturnId) await db.query('DELETE FROM Purchase_Returns WHERE id = ?', [boxReturnId]);
        if (testProductId) await db.query('DELETE FROM Products WHERE id = ?', [testProductId]);
        if (testSupplierId) await db.query('DELETE FROM Suppliers WHERE id = ?', [testSupplierId]);
        console.log('✓ هەموو داتاکانی تاقیکردنەوە بە خاوێنی سڕدرانەوە.');
        process.exit(0);
    }
}

runTest();
