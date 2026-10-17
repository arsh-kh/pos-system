require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');
const backupController = require('../controllers/backup');
const fs = require('fs');
const path = require('path');

function mockReqRes(body = {}, params = {}) {
    let statusCode = 200;
    let responseData = null;
    let responseHeaders = {};
    const req = { body, params, headers: { 'x-user-name': 'تەستەری باکئەپ' } };
    const res = {
        status: (code) => {
            statusCode = code;
            return res;
        },
        setHeader: (name, val) => {
            responseHeaders[name] = val;
            return res;
        },
        json: (data) => {
            responseData = data;
            return res;
        },
        send: (data) => {
            try {
                responseData = JSON.parse(data);
            } catch (_) {
                responseData = data;
            }
            return res;
        }
    };
    return { req, res, getResult: () => ({ statusCode, responseData, responseHeaders }) };
}

async function runBackupRestoreTests() {
    console.log('=== دەستپێکردنی تاقیکردنەوەی تەواوی باکئەپ و هێنانەوە (Backup & Restore Tests) ===');
    let testProductId = null;
    const testBarcode = 'BACKUP_TEST_' + Date.now();

    try {
        // 1. Test getBackupStats
        console.log('\n--- پشکنینی ئامارەکانی داتابەیس (Backup Stats) ---');
        const statsMock = mockReqRes();
        await backupController.getBackupStats(statsMock.req, statsMock.res);
        const statsRes = statsMock.getResult();
        if (statsRes.statusCode !== 200) {
            throw new Error(`شکستی وەرگرتنی ئامار: ${JSON.stringify(statsRes.responseData)}`);
        }
        const statsData = statsRes.responseData.data;
        console.log(`✓ کۆی خشتە دۆزراوەکان: ${statsData.totalTables} خشتە`);
        console.log(`✓ کۆی دێڕەکانی داتابەیس: ${statsData.totalRows} دێڕ`);
        if (statsData.totalTables < 20) {
            throw new Error(`پێویستە هەموو خشتەکان هەبن بەڵام تەنها ${statsData.totalTables} هەیە`);
        }

        // 2. Insert a temporary product & batch to test roundtrip restore
        const [prodInsert] = await db.query(
            "INSERT INTO Products (name, barcode, cost_price, selling_price, stock) VALUES ('شەربەتی ئەنەناسی تاقیکاری', ?, 1200, 2000, 50)",
            [testBarcode]
        );
        testProductId = prodInsert.insertId;
        console.log(`✓ کاڵای تاقیکاری بۆ باکئەپ دروستکرا: ID #${testProductId}, Barcode: ${testBarcode}`);

        // Insert a FIFO batch
        await db.query(
            "INSERT INTO Product_Batches (product_id, batch_number, initial_quantity, remaining_quantity, cost_price, selling_price, status) VALUES (?, 'BATCH-BK-001', 50, 50, 1200, 2000, 'ACTIVE')",
            [testProductId]
        );
        console.log('✓ وەجبەی FIFO بۆ کاڵای تاقیکاری دروستکرا');

        // 3. Test Full Download Backup
        console.log('\n--- پشکنینی دروستکردن و داگرتنی باکئەپ (Full Backup Generation) ---');
        const dlMock = mockReqRes();
        await backupController.downloadBackup(dlMock.req, dlMock.res);
        const dlRes = dlMock.getResult();
        const backupPayload = dlRes.responseData;

        if (!backupPayload || !backupPayload.metadata || !backupPayload.tables || !backupPayload.schemas) {
            throw new Error('پێکهاتەی فایلی باکئەپ ناتەواوە یان metadata/tables/schemas تێدا نییە');
        }

        const tableNames = Object.keys(backupPayload.tables);
        const schemaNames = Object.keys(backupPayload.schemas);
        console.log(`✓ باکئەپ دەرکرا بە سەرکەوتوویی: ${tableNames.length} خشتە و ${schemaNames.length} پێکهاتەی DDL لەناو باکئەپدایە`);

        if (schemaNames.length < 20) {
            throw new Error(`پێویستە پێکهاتەی DDL ی هەموو خشتەکان هەبێت، تەنها ${schemaNames.length} هەیە`);
        }
        console.log('✓ دڵنیابوونەوە لە پێکهاتەی خشتەکان (DDL schemas) بۆ ڕستۆرکردن لەسەر داتابەیسی بەتاڵ!');

        // Verify previously omitted tables are now all included!
        const criticalTables = ['product_batches', 'sale_item_batches', 'returns', 'audit_logs', 'users', 'products', 'sales'];
        const lowerCaseTables = tableNames.map(t => t.toLowerCase());
        for (const tbl of criticalTables) {
            if (!lowerCaseTables.includes(tbl)) {
                throw new Error(`خشتەی زۆر گرنگی ${tbl} لەناو باکئەپدا نییە!`);
            }
        }
        console.log('✓ هەموو خشتە گرنگەکان (product_batches, sale_item_batches, returns, audit_logs, users) لەناو باکئەپدان!');

        // Test manual snapshot creation API
        console.log('\n--- پشکنینی دروستکردنی دەستی و سڕینەوەی باکئەپ (Manual Snapshot & Delete) ---');
        const manualMock = mockReqRes({ note: 'کۆپی تاقیکاری' });
        await backupController.createManualSnapshot(manualMock.req, manualMock.res);
        const manualRes = manualMock.getResult();
        if (manualRes.statusCode !== 200 || !manualRes.responseData.data?.filename) {
            throw new Error('دروستکردنی دەستی باکئەپ شکستی هێنا');
        }
        const createdFilename = manualRes.responseData.data.filename;
        console.log(`✓ کۆپی دەستی بە سەرکەوتوویی دروستکرا: ${createdFilename}`);

        // Verify local snapshot file exists on disk
        const localSnapshotsMock = mockReqRes();
        await backupController.listLocalSnapshots(localSnapshotsMock.req, localSnapshotsMock.res);
        const localSnaps = localSnapshotsMock.getResult().responseData.data;
        if (!localSnaps || localSnaps.length === 0) {
            throw new Error('کۆپی ناوخۆیی (Server Snapshot) لە بوخچەی backups تۆمار نەکراوە');
        }
        console.log(`✓ لیستی کۆپییەکان: ${localSnaps.length} کۆپی لەسەر سێرڤەر هەیە`);

        // Test delete snapshot
        const delMock = mockReqRes({}, { filename: createdFilename });
        await backupController.deleteLocalSnapshot(delMock.req, delMock.res);
        if (delMock.getResult().statusCode !== 200) {
            throw new Error('سڕینەوەی باکئەپ شکستی هێنا');
        }
        console.log(`✓ سڕینەوەی باکئەپی سەر سێرڤەر بە سەرکەوتوویی تاقیکرایەوە: ${createdFilename}`);

        // 4. Test Simulated Data Disaster & Full Restoration
        console.log('\n--- شێواندنی بەئەنقەست و تاقیکردنەوەی هێنانەوە (Simulated Loss & Full Restore) ---');
        // Delete the product and its batch to simulate loss
        await db.query('DELETE FROM Product_Batches WHERE product_id = ?', [testProductId]);
        await db.query('DELETE FROM Products WHERE id = ?', [testProductId]);

        // Verify it was deleted
        const [verifyDeleted] = await db.query('SELECT * FROM Products WHERE barcode = ?', [testBarcode]);
        if (verifyDeleted.length > 0) {
            throw new Error('کاڵا بە سەرکەوتوویی نەسڕایەوە بۆ تاقیکردنەوە');
        }
        console.log('✓ کاڵاکە سڕدرایەوە لە داتابەیس (نموونەی ونبوون یان تێکچوونی داتا)');

        // Now RESTORE using the backupPayload
        const restoreMock = mockReqRes({ backupData: backupPayload });
        await backupController.restoreBackup(restoreMock.req, restoreMock.res);
        const restoreRes = restoreMock.getResult();

        if (restoreRes.statusCode !== 200 || restoreRes.responseData.status !== 'SUCCESS') {
            throw new Error(`شکستی هێنانەوەی باکئەپ: ${JSON.stringify(restoreRes.responseData)}`);
        }
        console.log(`✓ باکئەپەکە ڕستۆر کرا: ${restoreRes.responseData.data.restoredTableCount} خشتە و ${restoreRes.responseData.data.restoredRowCount} دێڕ هێنرانەوە`);

        // 5. Verify restored data in MySQL
        const [restoredProd] = await db.query('SELECT * FROM Products WHERE barcode = ?', [testBarcode]);
        if (restoredProd.length === 0) {
            throw new Error('کاڵاکە نەگەڕایەوە دوای هێنانەوەی باکئەپ!');
        }
        console.log(`✓ کاڵای ونبوو بە تەواوی گەڕایەوە: "${restoredProd[0].name}", مەخزەن: ${restoredProd[0].stock}`);

        const [restoredBatch] = await db.query('SELECT * FROM Product_Batches WHERE product_id = ?', [testProductId]);
        if (restoredBatch.length === 0) {
            throw new Error('وەجبەی FIFO نەگەڕایەوە دوای هێنانەوەی باکئەپ!');
        }
        console.log(`✓ وەجبەی FIFO ی کاڵاکەش بە تەواوی گەڕایەوە: ${restoredBatch[0].batch_number}, بڕ: ${restoredBatch[0].remaining_quantity}`);

        // 6. Test Invalid Backup Handling
        console.log('\n--- پشکنینی بەرگری لە فایلی خراپ (Invalid Backup Safety) ---');
        const badMock = mockReqRes({ backupData: { wrong: 'data' } });
        await backupController.restoreBackup(badMock.req, badMock.res);
        if (badMock.getResult().statusCode !== 400) {
            throw new Error('دەبوو فایلی هەڵە بە کۆدی ٤٠٠ ڕەت بکرێتەوە');
        }
        console.log('✓ سیستەم فایلی نادروست ڕەتدەکاتەوە و داتابەیس دەپارێزێت');

        // 7. Verify Auto-Increment Reset Works by Inserting New Product After Restore
        console.log('\n--- پشکنینی کارکردنی Auto-Increment دوای هێنانەوەی باکئەپ ---');
        const nextBarcode = 'POST_RESTORE_' + Date.now();
        const [postRestoreInsert] = await db.query(
            "INSERT INTO Products (name, barcode, cost_price, selling_price, stock) VALUES ('کاڵای پاش هێنانەوە', ?, 500, 1000, 10)",
            [nextBarcode]
        );
        const postRestoreId = postRestoreInsert.insertId;
        console.log(`✓ کاڵای نوێ دوای هێنانەوە بە سەرکەوتوویی دروستکرا: ID #${postRestoreId}`);
        if (!postRestoreId || postRestoreId <= testProductId) {
            throw new Error(`Auto-increment نوێ نەکراوەتەوە: ID ${postRestoreId} بچووکتر یان یەکسانە بە ID پێشوو ${testProductId}`);
        }
        await db.query('DELETE FROM Products WHERE id = ?', [postRestoreId]);
        console.log('✓ دڵنیابوونەوە لە Auto-Increment: نوێترین ID بە تەواوی ڕێکخراوە بێ هیچ کێشەیەک');

        console.log('\n======================================================');
        console.log('🎉 هەموو تاقیکردنەوەکانی باکئەپ و هێنانەوە ١٠٠٪ سەرکەوتوون!');
        console.log('======================================================');

    } catch (err) {
        console.error('❌ هەڵە لە تاقیکردنەوەی باکئەپ:', err);
        process.exitCode = 1;
    } finally {
        if (testProductId) {
            try {
                await db.query('DELETE FROM Product_Batches WHERE product_id = ?', [testProductId]);
                await db.query('DELETE FROM Products WHERE id = ?', [testProductId]);
                console.log('✓ کاڵای تاقیکاری بە خاوێنی پاککرایەوە');
            } catch (_) {}
        }
        process.exit(process.exitCode || 0);
    }
}

runBackupRestoreTests();
