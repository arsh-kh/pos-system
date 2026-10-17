require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const assert = require('assert');

const API_BASE = 'http://localhost:3001/api/backup';

async function runTests() {
    console.log('=== دەستپێکردنی تاقیکردنەوەی باکئەپی تێلیگرام (Telegram Cloud Backup Tests) ===\n');

    try {
        // --- 1. Test GET /api/backup/telegram/settings ---
        console.log('--- ١. پشکنینی وەرگرتنی ڕێکخستنەکان (GET Settings) ---');
        const getRes = await fetch(`${API_BASE}/telegram/settings`);
        assert.strictEqual(getRes.status, 200, 'GET settings must return 200');
        const getData = await getRes.json();
        assert.strictEqual(getData.status, 'SUCCESS', 'Status must be SUCCESS');
        assert(getData.data !== undefined, 'Settings data must exist');
        console.log('✓ ڕێکخستنەکان بە سەرکەوتوویی خوێنرانەوە:', {
            has_token: getData.data.has_token,
            chat_id: getData.data.chat_id || 'بەتاڵ',
            auto_backup: getData.data.auto_backup_enabled
        });

        // --- 2. Test POST /api/backup/telegram/settings ---
        console.log('\n--- ٢. پشکنینی پاشەکەوتکردنی ڕێکخستنەکان (Update Settings) ---');
        const updateRes = await fetch(`${API_BASE}/telegram/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bot_token: '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ',
                chat_id: '987654321',
                auto_backup_enabled: true,
                backup_frequency: 'DAILY'
            })
        });
        assert.strictEqual(updateRes.status, 200, 'Update settings must return 200');
        const updateData = await updateRes.json();
        assert.strictEqual(updateData.status, 'SUCCESS', 'Update status must be SUCCESS');

        // Verify updated settings
        const verifyRes = await fetch(`${API_BASE}/telegram/settings`);
        const verifyData = await verifyRes.json();
        assert.strictEqual(verifyData.data.chat_id, '987654321', 'Chat ID must match updated value');
        assert.strictEqual(verifyData.data.auto_backup_enabled, true, 'Auto backup must be true');
        assert.strictEqual(verifyData.data.has_token, true, 'has_token must be true');
        assert(verifyData.data.masked_token.includes('••••••••'), 'Token must be safely masked');
        console.log('✓ ڕێکخستنەکان پاشەکەوت کران و دڵنیابوونەوە لە شاردنەوەی تۆکن:', verifyData.data.masked_token);

        // --- 3. Test POST /api/backup/telegram/test (Validation & Network Gracefulness) ---
        console.log('\n--- ٣. پشکنینی تاقیکردنەوەی پەیوەندی بە تێلیگرام (Test Connection) ---');
        const testRes = await fetch(`${API_BASE}/telegram/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bot_token: '123456789:INVALID_MOCK_TOKEN',
                chat_id: '987654321'
            })
        });
        const testData = await testRes.json();
        // Since mock token is invalid, it should return graceful error (400 or 500) without crashing the server
        assert(testData.status === 'ERROR', 'Invalid token should return ERROR status gracefully');
        assert(testData.message !== undefined, 'Error message must be present');
        console.log('✓ سێرڤەر بە پارێزراوی وەڵامی تۆکنی نادروست یان بێ ئینتەرنێتی دایەوە بە زمانی کوردی:', testData.message);

        // --- 4. Test Missing Token/Chat ID Validation ---
        console.log('\n--- ٤. پشکنینی پەیامی هەڵە لە نەبوونی تۆکن یان چات ئایدی ---');
        const emptyTestRes = await fetch(`${API_BASE}/telegram/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bot_token: '', chat_id: '' })
        });
        const emptyData = await emptyTestRes.json();
        assert.strictEqual(emptyTestRes.status, 400, 'Should return 400 for empty inputs');
        assert(emptyData.message.includes('Bot Token'), 'Should prompt for Bot Token');
        console.log('✓ پەیامی ئاگاداری دروست نیشاندرا:', emptyData.message);

        // --- 5. Test Send Snapshot Validation (Non-existent snapshot) ---
        console.log('\n--- ٥. پشکنینی ناردنی کۆپییەکی دیاریکراو بۆ تێلیگرام ---');
        const snapRes = await fetch(`${API_BASE}/telegram/send-snapshot/non_existent_file.json`, {
            method: 'POST'
        });
        assert.strictEqual(snapRes.status, 404, 'Non-existent snapshot should return 404');
        console.log('✓ نەبوونی فایل بە دروستی مامەڵەی لەگەڵدا کرا (404 Not Found)');

        // --- 6. Clean up settings for fresh state ---
        console.log('\n--- ٦. پاککردنەوە و ڕێکخستنی بنەڕەتی ---');
        await fetch(`${API_BASE}/telegram/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bot_token: '',
                chat_id: '',
                auto_backup_enabled: false,
                backup_frequency: 'DAILY'
            })
        });
        console.log('✓ ڕێکخستنەکان گەڕێنرانەوە دۆخی دەستپێک');

        console.log('\n================================================================');
        console.log('🎉 هەموو تاقیکردنەوەکانی باکئەپی تێلیگرام بە سەرکەوتوویی تەواو بوون!');
        console.log('================================================================');
    } catch (err) {
        console.error('❌ تاقیکردنەوە سەرکەوتوو نەبوو:', err);
        process.exit(1);
    }
}

runTests();
