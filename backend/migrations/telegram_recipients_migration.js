require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');

async function runMigration() {
    console.log('--- دەستپێکردنی مەیگرەیشنی وەرگرانی تێلیگرام (Multiple Telegram Recipients Migration) ---');
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS Telegram_Recipients (
                id INT AUTO_INCREMENT PRIMARY KEY,
                chat_id VARCHAR(128) NOT NULL UNIQUE,
                recipient_name VARCHAR(128) NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_sent_at TIMESTAMP NULL,
                INDEX idx_recipient_active (is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ خشتەی Telegram_Recipients بە سەرکەوتوویی دروستکرا.');

        // Insert the user's chat ID (1796577602) as the primary recipient
        await db.query(`
            INSERT INTO Telegram_Recipients (chat_id, recipient_name, is_active)
            VALUES ('1796577602', 'Yaras (خاوەنکار)', TRUE)
            ON DUPLICATE KEY UPDATE recipient_name = 'Yaras (خاوەنکار)', is_active = TRUE;
        `);
        console.log('✓ وەرگری سەرەکی (1796577602) لە Telegram_Recipients تۆمار کرا.');

        process.exit(0);
    } catch (error) {
        console.error('❌ هەڵە لە مەیگرەیشن:', error);
        process.exit(1);
    }
}

runMigration();
