require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');
const fs = require('fs');
const path = require('path');
const { logAuditAction } = require('../middleware/auditLogger');
const { 
    handleIncomingBotCommand, 
    sendNightlyBackupAndSummary, 
    getDailyFinancialSummary 
} = require('../services/telegramNightlyScheduler');

let BACKUPS_DIR = path.resolve(__dirname, '../backups');
try {
    if (!fs.existsSync(BACKUPS_DIR)) {
        fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
} catch (err) {
    if (process.env.APPDATA) {
        BACKUPS_DIR = path.join(process.env.APPDATA, 'MarketPOS', 'backups');
        if (!fs.existsSync(BACKUPS_DIR)) {
            fs.mkdirSync(BACKUPS_DIR, { recursive: true });
        }
    }
}

// Built-in Telegram Bot credentials (Zero configuration required by Admin)
const DEFAULT_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8928798854:AAGlhCrK1qmBVTbNKlya71WBv_cERTbdX14';
const DEFAULT_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'cashier_system_bot';

// Helper to safely serialize BigInt and dates
const safeJsonStringify = (data) => {
    return JSON.stringify(data, (key, value) => {
        if (typeof value === 'bigint') {
            return value.toString();
        }
        return value;
    }, 2);
};

// Clean, human-readable local timestamp and filename
const getFormattedLocalTimestamp = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hours = now.getHours();
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = pad(hours % 12 || 12);

    const filename = `POS_Backup_${year}-${month}-${day}_${displayHours}-${minutes}-${ampm}.json`;
    const folderName = `POS_Backups_${year}-${month}`;
    const readableDate = `${year}-${month}-${day}`;
    const readableTime = `${displayHours}:${minutes}:${seconds} ${ampm}`;

    return { filename, folderName, readableDate, readableTime };
};

/**
 * Generate full database backup payload with DDL schemas and table records
 */
const buildFullBackupPayload = async (note = 'باکئەپی تەواوی سیستم') => {
    const [tables] = await db.query('SHOW TABLES');
    if (!tables || tables.length === 0) {
        throw new Error('هیچ خشتەیەک لە داتابەیسدا نەدۆزرایەوە');
    }

    const dbNameKey = Object.keys(tables[0])[0];
    const tableNames = tables.map(t => t[dbNameKey]);

    const backupData = {
        metadata: {
            version: '2.0',
            exported_at: new Date().toISOString(),
            database: process.env.DB_NAME || 'pos_db',
            note,
            total_tables: tableNames.length,
            table_counts: {}
        },
        schemas: {},
        tables: {}
    };

    let totalRows = 0;

    for (const tbl of tableNames) {
        try {
            const [schemaRes] = await db.query(`SHOW CREATE TABLE \`${tbl}\``);
            if (schemaRes && schemaRes[0]) {
                const keys = Object.keys(schemaRes[0]);
                backupData.schemas[tbl] = schemaRes[0]['Create Table'] || schemaRes[0][keys[1]];
            }
        } catch (_) {}

        try {
            const [rows] = await db.query(`SELECT * FROM \`${tbl}\``);
            backupData.tables[tbl] = rows;
            backupData.metadata.table_counts[tbl] = rows.length;
            totalRows += rows.length;
        } catch (err) {
            console.warn(`Warning: Could not backup table ${tbl}:`, err.message);
            backupData.tables[tbl] = [];
            backupData.metadata.table_counts[tbl] = 0;
        }
    }

    const jsonString = safeJsonStringify(backupData);
    return { backupData, jsonString, totalTables: tableNames.length, totalRows };
};

/**
 * Get Active Bot Token
 */
const getActiveBotToken = async () => {
    try {
        const [rows] = await db.query('SELECT bot_token FROM Telegram_Backup_Settings WHERE id = 1');
        if (rows.length > 0 && rows[0].bot_token && rows[0].bot_token.trim()) {
            return rows[0].bot_token.trim();
        }
    } catch (_) {}
    return DEFAULT_BOT_TOKEN;
};

/**
 * Background Auto-Pairing Worker:
 * Listens for any user starting @cashier_system_bot and automatically adds them to Telegram_Recipients!
 */
let lastOffset = 0;
let isPolling = false;

const pollTelegramUpdates = async () => {
    if (isPolling) return;
    isPolling = true;

    try {
        const token = await getActiveBotToken();
        const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${lastOffset}&timeout=5`, {
            signal: AbortSignal.timeout(10000)
        });
        const data = await res.json();

        if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
            for (const update of data.result) {
                lastOffset = Math.max(lastOffset, update.update_id + 1);

                const msg = update.message || update.channel_post || update.my_chat_member;
                if (!msg || !msg.chat) continue;

                const chatId = String(msg.chat.id);
                const senderName = msg.chat.first_name || msg.from?.first_name || msg.chat.title || 'خاوەنکار';
                const username = msg.chat.username ? `@${msg.chat.username}` : '';
                const fullName = `${senderName} ${username}`.trim();

                // Check if already in recipients
                const [existing] = await db.query('SELECT id FROM Telegram_Recipients WHERE chat_id = ?', [chatId]);

                if (existing.length === 0) {
                    await db.query(`
                        INSERT INTO Telegram_Recipients (chat_id, recipient_name, is_active)
                        VALUES (?, ?, TRUE)
                    `, [chatId, fullName]);

                    console.log(`✓ New Telegram recipient auto-registered: ${fullName} (ID: ${chatId})`);

                    // Send welcome confirmation to the new user's chat
                    const welcomeMsg = `🎉 *پیرۆزە! بە سەرکەوتوویی وەک وەرگری باکئەپ زیادکرایت*

سڵاو بەڕێز *${senderName}*،
ئەم چاتە بە شێوەیەکی ئۆتۆماتیکی وەک وەرگری باکئەپی سیستەمی POS زیادکرا.

🤖 *بۆتی فەرمی:* @${DEFAULT_BOT_USERNAME}
📱 *ناسنامەی تۆ:* \`${chatId}\`
🔄 *دۆخ:* چالاکە بۆ وەرگرتنی باکئەپ

لەمەودوا لە کاتی ناردنی باکئەپی فرۆشتن و داتابەیس، کۆپییەک دەگاتە ئەم چاتە.`;

                    try {
                        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chat_id: chatId,
                                text: welcomeMsg,
                                parse_mode: 'Markdown'
                            })
                        });
                    } catch (_) {}
                }

                // Handle interactive two-way bot commands (/today, /backup, /status, /help)
                if (msg.text && typeof msg.text === 'string') {
                    try {
                        await handleIncomingBotCommand(chatId, msg.text, senderName);
                    } catch (cmdErr) {
                        console.warn('Bot command processing error:', cmdErr.message);
                    }
                }
            }
        }
    } catch (_) {
    } finally {
        isPolling = false;
    }
};

// Start background auto-pairing listener every 5 seconds
setInterval(pollTelegramUpdates, 5000);
setTimeout(pollTelegramUpdates, 1500);

/**
 * Get All Recipients & Global Settings
 * GET /api/backup/telegram/settings
 */
exports.getTelegramSettings = async (req, res) => {
    try {
        const [settingsRows] = await db.query('SELECT * FROM Telegram_Backup_Settings WHERE id = 1');
        const settings = settingsRows[0] || {};

        const [recipients] = await db.query('SELECT * FROM Telegram_Recipients ORDER BY created_at ASC');

        const activeRecipients = recipients.filter(r => Boolean(r.is_active));

        res.json({
            status: 'SUCCESS',
            data: {
                bot_username: DEFAULT_BOT_USERNAME,
                bot_link: `https://t.me/${DEFAULT_BOT_USERNAME}`,
                auto_backup_enabled: Boolean(settings.auto_backup_enabled),
                last_sent_at: settings.last_sent_at,
                last_status: settings.last_status,
                last_error: settings.last_error,
                last_filename: settings.last_filename,
                last_file_size: settings.last_file_size || 0,
                recipients: recipients.map(r => ({
                    id: r.id,
                    chat_id: r.chat_id,
                    recipient_name: r.recipient_name,
                    is_active: Boolean(r.is_active),
                    created_at: r.created_at,
                    last_sent_at: r.last_sent_at
                })),
                totalRecipients: recipients.length,
                activeCount: activeRecipients.length
            }
        });
    } catch (error) {
        console.error('Error fetching Telegram settings:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Add New Recipient Manually (Admin adds Chat ID or Group ID)
 * POST /api/backup/telegram/recipients
 */
exports.addRecipient = async (req, res) => {
    try {
        const { chat_id, recipient_name } = req.body;
        if (!chat_id || !chat_id.trim()) {
            return res.status(400).json({ status: 'ERROR', message: 'تکایە Chat ID یان Group ID بنووسە' });
        }

        const cleanChatId = chat_id.trim();
        const cleanName = (recipient_name && recipient_name.trim()) ? recipient_name.trim() : `چات #${cleanChatId}`;

        await db.query(`
            INSERT INTO Telegram_Recipients (chat_id, recipient_name, is_active)
            VALUES (?, ?, TRUE)
            ON DUPLICATE KEY UPDATE recipient_name = VALUES(recipient_name), is_active = TRUE
        `, [cleanChatId, cleanName]);

        const token = await getActiveBotToken();

        // Send a greeting to the newly added chat
        const welcomeMsg = `🟢 *بەستنەوە بە سیستەمی باکئەپی POS*

سڵاو بەڕێز *${cleanName}*،
ئەم چاتە لە لایەن بەڕێوەبەری کۆگاوە وەک وەرگری باکئەپ زیادکرا.
📅 *کات:* ${new Date().toLocaleString('en-GB')}`;

        try {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: cleanChatId,
                    text: welcomeMsg,
                    parse_mode: 'Markdown'
                })
            });
        } catch (_) {}

        await logAuditAction({
            req,
            action_type: 'TELEGRAM_RECIPIENT_ADDED',
            entity_name: 'Telegram_Recipient',
            entity_id: 1,
            details: `زیادکردنی وەرگری نوێی تێلیگرام: ${cleanName} (${cleanChatId})`
        });

        res.json({
            status: 'SUCCESS',
            message: `وەرگری نوێ بە سەرکەوتوویی زیادکرا: ${cleanName}`
        });
    } catch (error) {
        console.error('Error adding recipient:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Toggle Recipient Active State (checkbox)
 * POST /api/backup/telegram/recipients/:id/toggle
 */
exports.toggleRecipient = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('UPDATE Telegram_Recipients SET is_active = NOT is_active WHERE id = ?', [id]);
        res.json({ status: 'SUCCESS', message: 'دۆخی وەرگر بە سەرکەوتوویی گۆڕدرا' });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Delete Recipient
 * DELETE /api/backup/telegram/recipients/:id
 */
exports.deleteRecipient = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM Telegram_Recipients WHERE id = ?', [id]);
        res.json({ status: 'SUCCESS', message: 'وەرگر بە سەرکەوتوویی سڕدرایەوە' });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Test Specific Recipient Ping
 * POST /api/backup/telegram/recipients/:id/test
 */
exports.testRecipient = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM Telegram_Recipients WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'وەرگر نەدۆزرایەوە' });
        }

        const r = rows[0];
        const token = await getActiveBotToken();

        const testMsg = `🟢 *پشکنینی پەیوەندی باکئەپی POS*

سڵاو بەڕێز *${r.recipient_name}*،
پەیوەندی لەگەڵ چاتی تۆ بە تەواوی ئۆنلاین و سەرکەوتووە!
📅 *کات:* ${new Date().toLocaleString('en-GB')}`;

        const sendMsgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: r.chat_id,
                text: testMsg,
                parse_mode: 'Markdown'
            }),
            signal: AbortSignal.timeout(8000)
        });

        const sendData = await sendMsgRes.json();
        if (!sendData.ok) {
            return res.status(400).json({
                status: 'ERROR',
                message: `هەڵە لە ناردن: ${sendData.description || 'تێلیگرام ڕەتیکردەوە'}`
            });
        }

        res.json({
            status: 'SUCCESS',
            message: `پەیامی تاقیکاری گەیشتە (${r.recipient_name})!`
        });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Toggle Global Auto-Backup
 * POST /api/backup/telegram/toggle-auto
 */
exports.toggleAutoBackup = async (req, res) => {
    try {
        const { enabled } = req.body;
        await db.query('UPDATE Telegram_Backup_Settings SET auto_backup_enabled = ? WHERE id = 1', [enabled ? 1 : 0]);
        res.json({
            status: 'SUCCESS',
            message: enabled ? 'ناردنی خۆکاری باکئەپ بۆ تێلیگرام چالاک کرا' : 'ناردنی خۆکاری باکئەپ بۆ تێلیگرام ناچالاک کرا'
        });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Send Full Database Backup to ALL Active Telegram Recipients (Broadcast)
 * POST /api/backup/telegram/send
 */
exports.sendBackupToTelegram = async (req, res) => {
    try {
        const [activeRecipients] = await db.query('SELECT * FROM Telegram_Recipients WHERE is_active = TRUE');

        if (!activeRecipients || activeRecipients.length === 0) {
            return res.status(400).json({
                status: 'ERROR',
                message: 'هیچ وەرگرێکی چالاک دیاری نەکراوە! تکایە لانی کەم چێکبۆکسی یەک وەرگر چالاک بکە یان لە ڕێگەی Start مۆبایلێک ببەستەوە.'
            });
        }

        const token = await getActiveBotToken();

        // 1. Build the full database backup payload
        const { backupData, jsonString, totalTables, totalRows } = await buildFullBackupPayload('ناردنی دەستی بۆ تێلیگرام لەلایەن ئەدمین');

        // Proper clean filename & folder format
        const { filename, folderName, readableDate, readableTime } = getFormattedLocalTimestamp();

        // 2. Also save local snapshot in backend/backups/
        const localFilePath = path.join(BACKUPS_DIR, filename);
        fs.writeFileSync(localFilePath, jsonString, 'utf8');

        // 3. Format Telegram Caption
        const caption = `🏪 *باکئەپی تەواوی داتابەیسی POS*

📁 *بوخچە (Folder):* \`${folderName}/\`
📄 *ناوی پەڕگە (File):* \`${filename}\`
📅 *بەروار (Date):* ${readableDate}
⏰ *کات (Time):* ${readableTime}
📊 *کۆی خشتەکان:* ${totalTables} خشتە
💾 *کۆی تۆمارەکان:* ${totalRows} دێڕ داتا
⚡ *شێواز:* باکئەپی دەستی (Direct Manual Dispatch)
🔒 *١٠٠٪ پارێزراوە لەگەڵ هەموو Schemas و داتا بۆ هێنانەوە (Restore)*`;

        const sizeBytes = Buffer.byteLength(jsonString, 'utf8');
        const successfulRecipients = [];
        const failedRecipients = [];

        // 4. Send document to each active recipient
        for (const recipient of activeRecipients) {
            try {
                const formData = new FormData();
                formData.append('chat_id', recipient.chat_id.trim());
                formData.append('caption', caption);
                formData.append('parse_mode', 'Markdown');

                const fileBlob = new Blob([Buffer.from(jsonString, 'utf8')], { type: 'application/json' });
                formData.append('document', fileBlob, filename);

                const telegramRes = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
                    method: 'POST',
                    body: formData,
                    signal: AbortSignal.timeout(35000)
                });

                const resultJson = await telegramRes.json();
                if (resultJson.ok) {
                    successfulRecipients.push(recipient.recipient_name);
                    await db.query('UPDATE Telegram_Recipients SET last_sent_at = NOW() WHERE id = ?', [recipient.id]);
                } else {
                    failedRecipients.push(`${recipient.recipient_name} (${resultJson.description || 'هەڵە'})`);
                }
            } catch (rErr) {
                failedRecipients.push(`${recipient.recipient_name} (${rErr.message})`);
            }
        }

        if (successfulRecipients.length > 0) {
            await db.query(`
                UPDATE Telegram_Backup_Settings 
                SET last_sent_at = NOW(),
                    last_status = 'SUCCESS',
                    last_error = NULL,
                    last_filename = ?,
                    last_file_size = ?
                WHERE id = 1
            `, [filename, sizeBytes]);

            await logAuditAction({
                req,
                action_type: 'BACKUP_TELEGRAM_SENT',
                entity_name: 'Telegram_Backup',
                entity_id: 1,
                details: `ناردنی باکئەپی داتابەیس بۆ (${successfulRecipients.length}) وەرگر: ${successfulRecipients.join('، ')}`
            });

            return res.json({
                status: 'SUCCESS',
                message: `باکئەپەکە (${filename}) بە سەرکەوتوویی بۆ (${successfulRecipients.length}) وەرگر نێردرا: ${successfulRecipients.join('، ')}`,
                data: {
                    filename,
                    sizeBytes,
                    sentAt: new Date(),
                    successfulCount: successfulRecipients.length,
                    failedCount: failedRecipients.length,
                    successfulRecipients,
                    failedRecipients
                }
            });
        } else {
            const errorSummary = failedRecipients.join('؛ ');
            await db.query(`UPDATE Telegram_Backup_Settings SET last_status = 'FAILED', last_error = ? WHERE id = 1`, [errorSummary]);
            return res.status(400).json({
                status: 'ERROR',
                message: `نەتوانرا بۆ هیچ وەرگرێک بنێردرێت: ${errorSummary}`
            });
        }
    } catch (error) {
        console.error('Error sending backup to Telegram:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Send Specific Snapshot to ALL Active Recipients
 * POST /api/backup/telegram/send-snapshot/:filename
 */
exports.sendSnapshotToTelegram = async (req, res) => {
    try {
        const { filename } = req.params;
        if (!filename || !/^[a-zA-Z0-9_\-\.]+\.json$/.test(filename)) {
            return res.status(400).json({ status: 'ERROR', message: 'ناوی پەڕگە نادروستە' });
        }

        const filePath = path.join(BACKUPS_DIR, filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ status: 'ERROR', message: 'پەڕگەی باکئەپ نەدۆزرایەوە' });
        }

        const [activeRecipients] = await db.query('SELECT * FROM Telegram_Recipients WHERE is_active = TRUE');
        if (!activeRecipients || activeRecipients.length === 0) {
            return res.status(400).json({ status: 'ERROR', message: 'هیچ وەرگرێکی چالاک دیاری نەکراوە.' });
        }

        const token = await getActiveBotToken();
        const fileContent = fs.readFileSync(filePath);
        const stats = fs.statSync(filePath);

        const caption = `📁 *ناردنی کۆپییەکی یەدەگی پێشوو بۆ تێلیگرام*

📄 *ناوی پەڕگە:* \`${filename}\`
📅 *بەرواری دروستبوون:* ${stats.mtime.toLocaleString('en-GB')}
💾 *قەبارە:* ${Math.round(stats.size / 1024)} KB
🔒 *ئامادەیە بۆ هێنانەوە (Restore) لە هەر ساتێکدا*`;

        let successCount = 0;
        for (const r of activeRecipients) {
            try {
                const formData = new FormData();
                formData.append('chat_id', r.chat_id.trim());
                formData.append('caption', caption);
                formData.append('parse_mode', 'Markdown');

                const fileBlob = new Blob([fileContent], { type: 'application/json' });
                formData.append('document', fileBlob, filename);

                const telegramRes = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
                    method: 'POST',
                    body: formData,
                    signal: AbortSignal.timeout(35000)
                });
                const resultJson = await telegramRes.json();
                if (resultJson.ok) successCount++;
            } catch (_) {}
        }

        res.json({
            status: 'SUCCESS',
            message: `کۆپی (${filename}) بە سەرکەوتوویی بۆ (${successCount}) وەرگر نێردرا!`
        });
    } catch (error) {
        console.error('Error sending snapshot to Telegram:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Background Automatic Dispatch Helper (called during periodic snapshot)
 */
exports.dispatchAutoTelegramBackup = async (filename, filePath, backupData) => {
    try {
        const [settingsRows] = await db.query('SELECT * FROM Telegram_Backup_Settings WHERE id = 1');
        const settings = settingsRows[0];

        if (!settings || !settings.auto_backup_enabled) {
            return;
        }

        const [activeRecipients] = await db.query('SELECT * FROM Telegram_Recipients WHERE is_active = TRUE');
        if (!activeRecipients || activeRecipients.length === 0) return;

        if (!fs.existsSync(filePath)) return;

        const token = await getActiveBotToken();
        const fileContent = fs.readFileSync(filePath);
        const stats = fs.statSync(filePath);

        const { folderName, readableDate, readableTime } = getFormattedLocalTimestamp();

        const caption = `🤖 *باکئەپی خۆکاری ڕۆژانەی سیستەمی POS*

📁 *بوخچە (Folder):* \`${folderName}/\`
📄 *ناوی پەڕگە (File):* \`${filename}\`
📅 *بەروار (Date):* ${readableDate}
⏰ *کات (Time):* ${readableTime}
📊 *کۆی خشتەکان:* ${backupData?.metadata?.total_tables || 0} خشتە
💾 *قەبارە:* ${Math.round(stats.size / 1024)} KB
⚡ *جۆر:* باکئەپی ئۆتۆماتیکی ڕۆژانە
🔒 *پارێزراوە لەسەر تێلیگرامی خاوەنکار*`;

        for (const r of activeRecipients) {
            try {
                const formData = new FormData();
                formData.append('chat_id', r.chat_id.trim());
                formData.append('caption', caption);
                formData.append('parse_mode', 'Markdown');

                const fileBlob = new Blob([fileContent], { type: 'application/json' });
                formData.append('document', fileBlob, filename);

                await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
                    method: 'POST',
                    body: formData,
                    signal: AbortSignal.timeout(40000)
                });
            } catch (_) {}
        }

        await db.query(`
            UPDATE Telegram_Backup_Settings 
            SET last_sent_at = NOW(),
                last_status = 'SUCCESS',
                last_error = NULL,
                last_filename = ?,
                last_file_size = ?
            WHERE id = 1
        `, [filename, stats.size]);
        console.log(`✓ Automated daily backup dispatched to ${activeRecipients.length} Telegram recipients: ${filename}`);
    } catch (err) {
        console.warn('Auto Telegram dispatch error:', err.message);
    }
};

/**
 * Manual Refresh / Check Pairing from UI
 * POST /api/backup/telegram/auto-detect
 */
exports.autoDetectChatId = async (req, res) => {
    await pollTelegramUpdates();
    const [recipients] = await db.query('SELECT * FROM Telegram_Recipients ORDER BY created_at ASC');

    res.json({
        status: 'SUCCESS',
        message: `لیستی وەرگران نوێکرایەوە (${recipients.length} وەرگر دۆزرایەوە)`,
        data: recipients
    });
};

/**
 * Trigger Nightly Summary & Full Backup On-Demand (Admin / Automated Trigger)
 * POST /api/backup/telegram/trigger-nightly
 */
exports.triggerNightlySummary = async (req, res) => {
    try {
        const result = await sendNightlyBackupAndSummary(true);
        if (result.success) {
            res.json({
                status: 'SUCCESS',
                message: `کورتەی ڕۆژانە و باکئەپی داتابەیس بە سەرکەوتوویی بۆ (${result.count}) وەرگر نێردرا!`,
                data: result
            });
        } else {
            res.status(400).json({
                status: 'ERROR',
                message: `نەتوانرا بنێردرێت: ${result.reason || result.error || 'هەڵەی نەزانراو'}`
            });
        }
    } catch (error) {
        console.error('triggerNightlySummary error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Get Daily Financial Summary JSON
 * GET /api/backup/telegram/daily-summary
 */
exports.getDailySummary = async (req, res) => {
    try {
        const { date } = req.query;
        const summary = await getDailyFinancialSummary(date || null);
        res.json({
            status: 'SUCCESS',
            data: summary
        });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

module.exports = exports;
