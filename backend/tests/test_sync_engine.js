require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');
const syncController = require('../controllers/sync');

function mockReqRes(body = {}, params = {}) {
    let statusCode = 200;
    let responseData = null;
    let responseHeaders = {};
    const req = { body, params, headers: { 'x-user-name': 'تەستەری هاوکاتکردن' } };
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
        }
    };
    return { req, res, getResult: () => ({ statusCode, responseData, responseHeaders }) };
}

async function runSyncTests() {
    console.log('=== دەستپێکردنی تاقیکردنەوەی سیستەمی هاوکاتکردنی ئۆفلاین و ئۆنلاین (Sync Engine Tests) ===');
    let testSyncId = null;

    try {
        // 1. Test queueing events
        console.log('\n--- ١. پشکنینی تۆمارکردن لە ڕیزبەندی هاوکاتکردن (Queue Event) ---');
        testSyncId = await syncController.queueSyncEvent({
            entity_type: 'SALE',
            entity_id: 'TEST_SALE_123',
            action_type: 'CREATE',
            payload: {
                total: '25000',
                items_count: 2,
                customer: 'کڕیاری تاقیکاری'
            }
        });

        if (!testSyncId) throw new Error('شکست لە دروستکردنی sync_id');
        console.log(`✓ تۆماری تاقیکاری لە ڕیزبەندی Sync_Queue دانرا: ${testSyncId}`);

        // Verify it exists in database with status PENDING
        const [queueCheck] = await db.query('SELECT * FROM Sync_Queue WHERE sync_id = ?', [testSyncId]);
        if (queueCheck.length === 0 || queueCheck[0].status !== 'PENDING') {
            throw new Error('تۆمارەکە لە Sync_Queue بە دۆخی PENDING نەدۆزرایەوە');
        }
        console.log('✓ دڵنیابوونەوە لە دۆخی سەرەتایی: PENDING و ئامادەیە بۆ هاوکاتکردن');

        // 2. Test getSyncStatus
        console.log('\n--- ٢. پشکنینی دۆخی هاوکاتکردن بۆ ئەدمین (getSyncStatus) ---');
        const statusMock = mockReqRes();
        await syncController.getSyncStatus(statusMock.req, statusMock.res);
        const statusRes = statusMock.getResult();
        if (statusRes.statusCode !== 200 || statusRes.responseData.status !== 'SUCCESS') {
            throw new Error('شکست لە وەرگرتنی دۆخی Sync');
        }
        const data = statusRes.responseData.data;
        console.log(`✓ ئامارەکان: چاوەڕوانکراو=${data.pendingCount}, هاوکاتکراو=${data.syncedCount}, ئینتەرنێت=${data.isOnline ? 'ONLINE' : 'OFFLINE'}`);
        if (data.pendingCount < 1) {
            throw new Error('پێویستە لانی کەم ١ دانە لە چاوەڕوانیدا بێت');
        }

        // 3. Test triggerSync (Push to Cloud)
        console.log('\n--- ٣. پشکنینی ئەنجامدانی هاوکاتکردن لەگەڵ کلاود (triggerSync) ---');
        const triggerMock = mockReqRes();
        await syncController.triggerSync(triggerMock.req, triggerMock.res);
        const triggerRes = triggerMock.getResult();
        if (triggerRes.statusCode !== 200 || triggerRes.responseData.status !== 'SUCCESS') {
            throw new Error(`شکستی triggerSync: ${JSON.stringify(triggerRes.responseData)}`);
        }
        console.log(`✓ ئەنجامی هاوکاتکردن: ${triggerRes.responseData.message}`);

        // Verify status changed to SYNCED (with micro-retry if queue worker is committing)
        let syncedCheck;
        for (let attempt = 0; attempt < 5; attempt++) {
            const [rows] = await db.query('SELECT * FROM Sync_Queue WHERE sync_id = ?', [testSyncId]);
            syncedCheck = rows;
            if (syncedCheck[0]?.status === 'SYNCED' && syncedCheck[0]?.synced_at) break;
            await new Promise(r => setTimeout(r, 60));
        }
        if (syncedCheck[0].status !== 'SYNCED' || !syncedCheck[0].synced_at) {
            throw new Error('دۆخی تۆمارەکە نەگۆڕدرا بۆ SYNCED');
        }
        console.log(`✓ دۆخی تۆمارەکە لە Sync_Queue بە سەرکەوتوویی بوو بە SYNCED لە کاتی ${syncedCheck[0].synced_at}`);

        // Verify Cloud received it
        const [cloudCheck] = await db.query('SELECT * FROM Cloud_Received_Records WHERE sync_id = ?', [testSyncId]);
        if (cloudCheck.length === 0) {
            throw new Error('تۆمارەکە لە Cloud_Received_Records نەگەیشتووە');
        }
        console.log('✓ دڵنیابوونەوە لە وەرگرتنی کلاود (Cloud Ingestion Verified)');

        // 4. Test Idempotency (Sending same sync_id again)
        console.log('\n--- ٤. پشکنینی بەرگری لە داتای دووبارە (Idempotency Protection) ---');
        const pushMock = mockReqRes({
            items: [{
                sync_id: testSyncId,
                entity_type: 'SALE',
                entity_id: 'TEST_SALE_123',
                action_type: 'CREATE',
                payload: { total: '25000' }
            }]
        });
        await syncController.cloudPush(pushMock.req, pushMock.res);
        const pushRes = pushMock.getResult();
        if (pushRes.statusCode !== 200) {
            throw new Error('کلاود وەرگرتنی دووبارەی بە هەڵە زانی لە جیاتی نوێکردنەوە');
        }
        const [countDup] = await db.query('SELECT COUNT(*) as cnt FROM Cloud_Received_Records WHERE sync_id = ?', [testSyncId]);
        if (countDup[0].cnt !== 1) {
            throw new Error(`داتای دووبارە دروستبوو: ژمارە=${countDup[0].cnt}`);
        }
        console.log('✓ سیستەمی کلاود بە تەواوی داتای دووبارە ڕەتدەکاتەوە (١٠٠٪ پارێزراوە لە کاتی Syncی دووبارە)');

        // Clean up test record
        await db.query('DELETE FROM Sync_Queue WHERE sync_id = ?', [testSyncId]);
        await db.query('DELETE FROM Cloud_Received_Records WHERE sync_id = ?', [testSyncId]);
        console.log('✓ داتای تاقیکاری بە خاوێنی پاککرایەوە');

        console.log('\n================================================================');
        console.log('🎉 هەموو تاقیکردنەوەکانی سیستەمی هاوکاتکردنی Sync Engine ١٠٠٪ سەرکەوتوون!');
        console.log('================================================================');
        process.exit(0);

    } catch (err) {
        console.error('❌ هەڵە لە تاقیکردنەوەی Sync:', err);
        if (testSyncId) {
            try {
                await db.query('DELETE FROM Sync_Queue WHERE sync_id = ?', [testSyncId]);
                await db.query('DELETE FROM Cloud_Received_Records WHERE sync_id = ?', [testSyncId]);
            } catch (_) {}
        }
        process.exit(1);
    }
}

runSyncTests();
