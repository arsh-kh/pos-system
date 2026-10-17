require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const assert = require('assert');

const API_BASE = 'http://localhost:3001/api/backup';

async function runTests() {
    console.log('=== دەستپێکردنی تاقیکردنەوەی باکئەپی فرە-وەرگری تێلیگرام (Multi-Recipient Telegram Backup Tests) ===\n');

    let createdRecipientId = null;

    try {
        // --- 1. Test GET /api/backup/telegram/settings ---
        console.log('--- ١. پشکنینی وەرگرتنی ڕێکخستنەکان و وەرگرەکان (GET Settings) ---');
        const getRes = await fetch(`${API_BASE}/telegram/settings`);
        assert.strictEqual(getRes.status, 200, 'GET settings must return 200');
        const getData = await getRes.json();
        assert.strictEqual(getData.status, 'SUCCESS', 'Status must be SUCCESS');
        assert(getData.data !== undefined, 'Settings data must exist');
        assert(Array.isArray(getData.data.recipients), 'Recipients must be an array');
        console.log('✓ ڕێکخستنەکان خوێنرانەوە:', {
            bot_username: getData.data.bot_username,
            totalRecipients: getData.data.totalRecipients,
            activeCount: getData.data.activeCount,
            auto_backup: getData.data.auto_backup_enabled
        });

        // --- 2. Test POST /api/backup/telegram/recipients (Add Recipient) ---
        console.log('\n--- ٢. پشکنینی زیادکردنی وەرگری نوێ (Add Recipient) ---');
        const testChatId = '999888777';
        const testName = 'چاتی تاقیکاری ئەدمین';
        const addRes = await fetch(`${API_BASE}/telegram/recipients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: testChatId,
                recipient_name: testName
            })
        });
        assert.strictEqual(addRes.status, 200, 'Add recipient must return 200');
        const addData = await addRes.json();
        assert.strictEqual(addData.status, 'SUCCESS', 'Add status must be SUCCESS');
        console.log('✓ وەرگری تاقیکاری بە سەرکەوتوویی زیادکرا');

        // Verify recipient was added
        const verifyRes = await fetch(`${API_BASE}/telegram/settings`);
        const verifyData = await verifyRes.json();
        const found = verifyData.data.recipients.find(r => r.chat_id === testChatId);
        assert(found, 'Added recipient must exist in recipients list');
        assert.strictEqual(found.recipient_name, testName, 'Recipient name must match');
        assert.strictEqual(found.is_active, true, 'New recipient must be active by default');
        createdRecipientId = found.id;
        console.log('✓ دڵنیابوونەوە لە تۆمارکرانی وەرگر:', { id: found.id, name: found.recipient_name });

        // --- 3. Test POST /api/backup/telegram/recipients/:id/toggle ---
        console.log('\n--- ٣. پشکنینی گۆڕینی دۆخی وەرگر (Toggle Recipient) ---');
        const toggleRes = await fetch(`${API_BASE}/telegram/recipients/${createdRecipientId}/toggle`, {
            method: 'POST'
        });
        assert.strictEqual(toggleRes.status, 200, 'Toggle recipient must return 200');

        // Verify it was toggled to inactive
        const verifyToggleRes = await fetch(`${API_BASE}/telegram/settings`);
        const verifyToggleData = await verifyToggleRes.json();
        const toggledRecipient = verifyToggleData.data.recipients.find(r => r.id === createdRecipientId);
        assert.strictEqual(toggledRecipient.is_active, false, 'Recipient should now be inactive');
        console.log('✓ دۆخی وەرگر بە سەرکەوتوویی گۆڕدرا بۆ ناچالاک (is_active: false)');

        // Toggle back to active
        await fetch(`${API_BASE}/telegram/recipients/${createdRecipientId}/toggle`, { method: 'POST' });
        const verifyToggleBackRes = await fetch(`${API_BASE}/telegram/settings`);
        const verifyToggleBackData = await verifyToggleBackRes.json();
        const toggledBackRecipient = verifyToggleBackData.data.recipients.find(r => r.id === createdRecipientId);
        assert.strictEqual(toggledBackRecipient.is_active, true, 'Recipient should be active again');
        console.log('✓ دۆخی وەرگر گەڕێندرایەوە بۆ چالاک (is_active: true)');

        // --- 4. Test POST /api/backup/telegram/toggle-auto ---
        console.log('\n--- ٤. پشکنینی گۆڕینی باکئەپی خۆکار (Toggle Auto Backup) ---');
        const autoRes = await fetch(`${API_BASE}/telegram/toggle-auto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: true })
        });
        assert.strictEqual(autoRes.status, 200, 'Toggle auto backup must return 200');
        const autoData = await autoRes.json();
        assert.strictEqual(autoData.status, 'SUCCESS', 'Toggle auto status must be SUCCESS');
        console.log('✓ دۆخی باکئەپی خۆکار گۆڕدرا بە سەرکەوتوویی');

        // --- 5. Test Non-existent Snapshot Handling ---
        console.log('\n--- ٥. پشکنینی پارێزگاری لە نەبوونی فایلی سناپشات ---');
        const snapRes = await fetch(`${API_BASE}/telegram/send-snapshot/non_existent_file.json`, {
            method: 'POST'
        });
        assert.strictEqual(snapRes.status, 404, 'Non-existent snapshot should return 404');
        console.log('✓ نەبوونی فایل بە دروستی مامەڵەی لەگەڵدا کرا (404 Not Found)');

        // --- 6. Clean up: Delete Test Recipient ---
        console.log('\n--- ٦. پاککردنەوە: سڕینەوەی وەرگری تاقیکاری (Delete Recipient) ---');
        const delRes = await fetch(`${API_BASE}/telegram/recipients/${createdRecipientId}`, {
            method: 'DELETE'
        });
        assert.strictEqual(delRes.status, 200, 'Delete recipient must return 200');
        const delData = await delRes.json();
        assert.strictEqual(delData.status, 'SUCCESS', 'Delete status must be SUCCESS');

        // Confirm deleted
        const finalRes = await fetch(`${API_BASE}/telegram/settings`);
        const finalData = await finalRes.json();
        const stillExists = finalData.data.recipients.some(r => r.id === createdRecipientId);
        assert(!stillExists, 'Deleted recipient must not exist in list');
        console.log('✓ وەرگری تاقیکاری بە سەرکەوتوویی لە داتابەیس پاککرایەوە');

        console.log('\n================================================================');
        console.log('🎉 هەموو تاقیکردنەوەکانی باکئەپی فرە-وەرگری تێلیگرام ١٠٠٪ سەرکەوتوون!');
        console.log('================================================================');
    } catch (err) {
        console.error('❌ تاقیکردنەوە سەرکەوتوو نەبوو:', err);
        // Clean up if recipient was created
        if (createdRecipientId) {
            try {
                await fetch(`${API_BASE}/telegram/recipients/${createdRecipientId}`, { method: 'DELETE' });
            } catch (_) {}
        }
        process.exit(1);
    }
}

runTests();
