const db = require('../db');
const fs = require('fs');
const path = require('path');
const { logAuditAction } = require('../middleware/auditLogger');

const BACKUPS_DIR = path.resolve(__dirname, '../backups');

if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Helper to safely serialize BigInt and dates
const safeJsonStringify = (data) => {
    return JSON.stringify(data, (key, value) => {
        if (typeof value === 'bigint') {
            return value.toString();
        }
        return value;
    }, 2);
};

// Mask sensitive token for display: 123456:ABC...XYZ
const maskToken = (token) => {
    if (!token || token.length < 10) return token ? '••••••••' : '';
    const parts = token.split(':');
    if (parts.length === 2) {
        const idPart = parts[0];
        const secretPart = parts[1];
        const visible = secretPart.slice(-4);
        return `${idPart}:••••••••${visible}`;
    }
    return `${token.slice(0, 4)}••••••••${token.slice(-4)}`;
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
        // 1. Export table DDL schema
        try {
            const [schemaRes] = await db.query(`SHOW CREATE TABLE \`${tbl}\``);
            if (schemaRes && schemaRes[0]) {
                const keys = Object.keys(schemaRes[0]);
                backupData.schemas[tbl] = schemaRes[0]['Create Table'] || schemaRes[0][keys[1]];
            }
        } catch (_) {}

        // 2. Export table data rows
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
 * Get Telegram Backup Settings
 * GET /api/backup/telegram/settings
 */
exports.getTelegramSettings = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM Telegram_Backup_Settings WHERE id = 1');
        const settings = rows[0] || {
            bot_token: '',
            chat_id: '',
            auto_backup_enabled: 0,
            backup_frequency: 'DAILY',
            last_status: 'NONE'
        };

        res.json({
            status: 'SUCCESS',
            data: {
                ...settings,
                auto_backup_enabled: Boolean(settings.auto_backup_enabled),
                has_token: Boolean(settings.bot_token),
                masked_token: maskToken(settings.bot_token)
            }
        });
    } catch (error) {
        console.error('Error fetching Telegram settings:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Update Telegram Backup Settings
 * POST /api/backup/telegram/settings
 */
exports.updateTelegramSettings = async (req, res) => {
    try {
        const { bot_token, chat_id, auto_backup_enabled, backup_frequency } = req.body;

        // Fetch existing row to preserve token if user leaves it unchanged
        const [existing] = await db.query('SELECT bot_token FROM Telegram_Backup_Settings WHERE id = 1');
        let finalToken = bot_token;
        if (bot_token === undefined || bot_token === null || bot_token === '') {
            // Keep existing if blank and existing exists
            finalToken = existing[0]?.bot_token || '';
        }

        await db.query(`
            UPDATE Telegram_Backup_Settings 
            SET bot_token = ?, 
                chat_id = ?, 
                auto_backup_enabled = ?, 
                backup_frequency = ?
            WHERE id = 1
        `, [
            finalToken ? finalToken.trim() : '',
            chat_id ? chat_id.trim() : '',
            auto_backup_enabled ? 1 : 0,
            backup_frequency || 'DAILY'
        ]);

        await logAuditAction({
            req,
            action_type: 'TELEGRAM_SETTINGS_UPDATED',
            entity_name: 'Telegram_Backup',
            entity_id: 1,
            details: `نوێکردنەوەی ڕێکخستنەکانی باکئەپی تێلیگرام (Chat ID: ${chat_id || 'نییە'}, ناردنی خۆکار: ${auto_backup_enabled ? 'چالاکە' : 'ناچالاکە'})`
        });

        res.json({
            status: 'SUCCESS',
            message: 'ڕێکخستنەکانی باکئەپی تێلیگرام بە سەرکەوتوویی پاشەکەوت کران'
        });
    } catch (error) {
        console.error('Error updating Telegram settings:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Test Telegram Connection
 * POST /api/backup/telegram/test
 */
exports.testTelegramConnection = async (req, res) => {
    try {
        let { bot_token, chat_id } = req.body || {};

        // If undefined in body, load from DB
        if (bot_token === undefined || chat_id === undefined) {
            const [rows] = await db.query('SELECT bot_token, chat_id FROM Telegram_Backup_Settings WHERE id = 1');
            if (rows.length > 0) {
                if (bot_token === undefined) bot_token = rows[0].bot_token;
                if (chat_id === undefined) chat_id = rows[0].chat_id;
            }
        }

        if (!bot_token || !bot_token.trim()) {
            return res.status(400).json({
                status: 'ERROR',
                message: 'تکایە Bot Tokenی تێلیگرام بنووسە یان پاشەکەوتی بکە'
            });
        }

        if (!chat_id || !chat_id.trim()) {
            return res.status(400).json({
                status: 'ERROR',
                message: 'تکایە Chat IDی چاتی خاوەنکار بنووسە یان پاشەکەوتی بکە'
            });
        }

        const cleanToken = bot_token.trim();
        const cleanChatId = chat_id.trim();

        // 1. Verify Bot Token with getMe
        let getMeRes;
        try {
            getMeRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`, {
                method: 'GET',
                signal: AbortSignal.timeout(6000)
            });
        } catch (fetchErr) {
            return res.status(500).json({
                status: 'ERROR',
                message: 'پەیوەندی لەگەڵ سێرڤەری تێلیگرام دروست نەبوو. تکایە دڵنیاببەرەوە کە کۆمپیوتەرەکەت بە ئینتەرنێتەوە بەستراوە.'
            });
        }

        const getMeData = await getMeRes.json();
        if (!getMeData.ok) {
            return res.status(400).json({
                status: 'ERROR',
                message: `تۆکنی بۆتەکە نادروستە: ${getMeData.description || 'هەڵە لە باوەڕپێکردن'}`
            });
        }

        const botName = getMeData.result?.first_name || 'POS Bot';
        const botUsername = getMeData.result?.username ? `@${getMeData.result.username}` : '';

        // 2. Send test message to Chat ID
        const testMessage = `🟢 *پشکنینی پەیوەندی باکئەپی POS*

سڵاو! پەیوەندی نێوان سیستەمی کۆگای POS و ئەم چاتە بە سەرکەوتوویی بەسترا.

🤖 *ناوی بۆت:* ${botName} (${botUsername})
📅 *بەروار و کات:* ${new Date().toLocaleString('en-GB')}
🔒 *ئامادەیە بۆ وەرگرتنی فایلی باکئەپی تەواوی داتابەیس*`;

        let sendMsgRes;
        try {
            sendMsgRes = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: cleanChatId,
                    text: testMessage,
                    parse_mode: 'Markdown'
                }),
                signal: AbortSignal.timeout(8000)
            });
        } catch (msgErr) {
            return res.status(500).json({
                status: 'ERROR',
                message: 'هەڵە لە ناردنی پەیامی تاقیکاری: ' + msgErr.message
            });
        }

        const sendMsgData = await sendMsgRes.json();
        if (!sendMsgData.ok) {
            let userHint = sendMsgData.description;
            if (sendMsgData.description?.includes('chat not found') || sendMsgData.description?.includes('Forbidden')) {
                userHint += ' (تکایە سەرەتا لە تێلیگرام بچۆ ناو بۆتەکەت و دوگمەی Start لێبدە بۆ ئەوەی بۆتەکە مۆڵەتی ناردنی نامەی بۆت هەبێت).';
            }
            return res.status(400).json({
                status: 'ERROR',
                message: `نەتوانرا پەیام بنێردرێت بۆ Chat ID: ${userHint}`
            });
        }

        res.json({
            status: 'SUCCESS',
            message: `پەیوەندی لەگەڵ تێلیگرام ١٠٠٪ سەرکەوتووە! پەیامی تاقیکاری لەلایەن (${botName}) گەیشت.`,
            data: {
                bot_name: botName,
                bot_username: botUsername
            }
        });
    } catch (error) {
        console.error('Telegram test error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Send Full Database Backup to Telegram (Manual Instant Dispatch)
 * POST /api/backup/telegram/send
 */
exports.sendBackupToTelegram = async (req, res) => {
    try {
        const [settingsRows] = await db.query('SELECT * FROM Telegram_Backup_Settings WHERE id = 1');
        const settings = settingsRows[0];

        if (!settings || !settings.bot_token || !settings.chat_id) {
            return res.status(400).json({
                status: 'ERROR',
                message: 'تکایە سەرەتا Bot Token و Chat IDی تێلیگرام لە بەشی خوارەوە دابنێ و پاشەکەوتی بکە.'
            });
        }

        const cleanToken = settings.bot_token.trim();
        const cleanChatId = settings.chat_id.trim();

        // 1. Build the full database backup payload
        const { backupData, jsonString, totalTables, totalRows } = await buildFullBackupPayload('ناردنی دەستی بۆ تێلیگرام لەلایەن ئەدمین');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `pos_backup_${timestamp}.json`;

        // 2. Also save local snapshot in backend/backups/
        const localFilePath = path.join(BACKUPS_DIR, filename);
        fs.writeFileSync(localFilePath, jsonString, 'utf8');

        // 3. Format Telegram Caption in Kurdish Markdown
        const caption = `🏪 *باکئەپی تەواوی سیستەمی POS*

📅 *بەروار و کات:* ${new Date().toLocaleString('en-GB')}
📊 *کۆی خشتەکان:* ${totalTables} خشتە
💾 *کۆی دێڕەکانی داتا:* ${totalRows} دێڕ
📁 *ناوی پەڕگە:* \`${filename}\`
⚡ *شێواز:* باکئەپی دەستی (Manual Instant Backup)
🔒 *پارێزراوە لەگەڵ هەموو Schemas و داتا بۆ هێنانەوە (Restore)*`;

        // 4. Send document to Telegram using FormData
        const formData = new FormData();
        formData.append('chat_id', cleanChatId);
        formData.append('caption', caption);
        formData.append('parse_mode', 'Markdown');

        const fileBlob = new Blob([Buffer.from(jsonString, 'utf8')], { type: 'application/json' });
        formData.append('document', fileBlob, filename);

        let telegramRes;
        try {
            telegramRes = await fetch(`https://api.telegram.org/bot${cleanToken}/sendDocument`, {
                method: 'POST',
                body: formData,
                signal: AbortSignal.timeout(35000)
            });
        } catch (fetchErr) {
            // Update last_status = FAILED
            await db.query(`
                UPDATE Telegram_Backup_Settings 
                SET last_status = 'FAILED', last_error = ? 
                WHERE id = 1
            `, [fetchErr.message]);

            return res.status(500).json({
                status: 'ERROR',
                message: 'پەیوەندی لەگەڵ تێلیگرام سەرکەوتوو نەبوو. تکایە پشکنین بۆ هێڵی ئینتەرنێت بکە: ' + fetchErr.message
            });
        }

        const resultJson = await telegramRes.json();
        if (!resultJson.ok) {
            const errMsg = resultJson.description || 'هەڵەی نەزانراو لە تێلیگرام';
            await db.query(`
                UPDATE Telegram_Backup_Settings 
                SET last_status = 'FAILED', last_error = ? 
                WHERE id = 1
            `, [errMsg]);

            return res.status(400).json({
                status: 'ERROR',
                message: `تێلیگرام فایلەکەی ڕەتکردەوە: ${errMsg}`
            });
        }

        const sizeBytes = Buffer.byteLength(jsonString, 'utf8');

        // 5. Update settings with successful status
        await db.query(`
            UPDATE Telegram_Backup_Settings 
            SET last_sent_at = NOW(),
                last_status = 'SUCCESS',
                last_error = NULL,
                last_filename = ?,
                last_file_size = ?
            WHERE id = 1
        `, [filename, sizeBytes]);

        // Audit log
        await logAuditAction({
            req,
            action_type: 'BACKUP_TELEGRAM_SENT',
            entity_name: 'Telegram_Backup',
            entity_id: 1,
            details: `ناردنی باکئەپی تەواوی داتابەیس بۆ تێلیگرام (${totalTables} خشتە، ${totalRows} دێڕ، پەڕگەی ${filename})`
        });

        res.json({
            status: 'SUCCESS',
            message: 'باکئەپەکە بە سەرکەوتوویی بۆ تێلیگرامی خاوەنکار نێردرا!',
            data: {
                filename,
                sizeBytes,
                sentAt: new Date(),
                totalTables,
                totalRows
            }
        });
    } catch (error) {
        console.error('Error sending backup to Telegram:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Send Specific Existing Server Snapshot to Telegram
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
            return res.status(404).json({ status: 'ERROR', message: 'پەڕگەی باکئەپ لەسەر سێرڤەر نەدۆزرایەوە' });
        }

        const [settingsRows] = await db.query('SELECT * FROM Telegram_Backup_Settings WHERE id = 1');
        const settings = settingsRows[0];

        if (!settings || !settings.bot_token || !settings.chat_id) {
            return res.status(400).json({
                status: 'ERROR',
                message: 'تکایە سەرەتا Bot Token و Chat IDی تێلیگرام پاشەکەوت بکە.'
            });
        }

        const fileContent = fs.readFileSync(filePath);
        const stats = fs.statSync(filePath);

        // Try reading metadata
        let metadataInfo = '';
        try {
            const parsed = JSON.parse(fileContent.toString('utf8'));
            if (parsed.metadata) {
                metadataInfo = `\n📊 *خشتەکان:* ${parsed.metadata.total_tables || 'نادیار'}\n⚡ *جۆر:* ${parsed.metadata.note || parsed.metadata.type || 'کۆپی سێرڤەر'}`;
            }
        } catch (_) {}

        const caption = `📁 *ناردنی کۆپییەکی یەدەگی پێشوو بۆ تێلیگرام*

📄 *ناوی پەڕگە:* \`${filename}\`
📅 *بەرواری دروستبوون:* ${stats.mtime.toLocaleString('en-GB')}
💾 *قەبارە:* ${Math.round(stats.size / 1024)} KB${metadataInfo}
🔒 *ئامادەیە بۆ هێنانەوە (Restore) لە هەر کاتێکدا*`;

        const formData = new FormData();
        formData.append('chat_id', settings.chat_id.trim());
        formData.append('caption', caption);
        formData.append('parse_mode', 'Markdown');

        const fileBlob = new Blob([fileContent], { type: 'application/json' });
        formData.append('document', fileBlob, filename);

        const telegramRes = await fetch(`https://api.telegram.org/bot${settings.bot_token.trim()}/sendDocument`, {
            method: 'POST',
            body: formData,
            signal: AbortSignal.timeout(35000)
        });

        const resultJson = await telegramRes.json();
        if (!resultJson.ok) {
            return res.status(400).json({
                status: 'ERROR',
                message: `تێلیگرام فایلەکەی ڕەتکردەوە: ${resultJson.description || 'هەڵە لە ناردن'}`
            });
        }

        await logAuditAction({
            req,
            action_type: 'BACKUP_TELEGRAM_SENT',
            entity_name: 'Telegram_Backup',
            entity_id: 1,
            details: `ناردنی کۆپی سێرڤەر (${filename}) بۆ تێلیگرام`
        });

        res.json({
            status: 'SUCCESS',
            message: `کۆپی (${filename}) بە سەرکەوتوویی بۆ تێلیگرام نێردرا!`
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

        if (!settings || !settings.auto_backup_enabled || !settings.bot_token || !settings.chat_id) {
            return; // Auto backup not enabled or missing credentials
        }

        if (!fs.existsSync(filePath)) return;

        const fileContent = fs.readFileSync(filePath);
        const stats = fs.statSync(filePath);

        const caption = `🤖 *باکئەپی خۆکاری ڕۆژانەی سیستەمی POS*

📅 *بەروار و کات:* ${new Date().toLocaleString('en-GB')}
📊 *کۆی خشتەکان:* ${backupData?.metadata?.total_tables || 0} خشتە
📁 *ناوی پەڕگە:* \`${filename}\`
💾 *قەبارە:* ${Math.round(stats.size / 1024)} KB
⚡ *جۆر:* ناردنی خۆکار لە باگراوند (Auto Daily Dispatch)
🔒 *پارێزراوە لەسەر تێلیگرامی خاوەنکار*`;

        const formData = new FormData();
        formData.append('chat_id', settings.chat_id.trim());
        formData.append('caption', caption);
        formData.append('parse_mode', 'Markdown');

        const fileBlob = new Blob([fileContent], { type: 'application/json' });
        formData.append('document', fileBlob, filename);

        const res = await fetch(`https://api.telegram.org/bot${settings.bot_token.trim()}/sendDocument`, {
            method: 'POST',
            body: formData,
            signal: AbortSignal.timeout(40000)
        });

        const data = await res.json();
        if (data.ok) {
            await db.query(`
                UPDATE Telegram_Backup_Settings 
                SET last_sent_at = NOW(),
                    last_status = 'SUCCESS',
                    last_error = NULL,
                    last_filename = ?,
                    last_file_size = ?
                WHERE id = 1
            `, [filename, stats.size]);
            console.log(`✓ Automated daily backup successfully dispatched to Telegram: ${filename}`);
        } else {
            console.warn(`Telegram auto-backup failed:`, data.description);
            await db.query(`
                UPDATE Telegram_Backup_Settings 
                SET last_status = 'FAILED',
                    last_error = ?
                WHERE id = 1
            `, [data.description]);
        }
    } catch (err) {
        console.warn('Auto Telegram dispatch error:', err.message);
    }
};

module.exports = exports;
