require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');

async function runMigration() {
    console.log('--- دەستپێکردنی مەیگرەیشنی باکئەپی تێلیگرام (Telegram Backup Migration) ---');
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS Telegram_Backup_Settings (
                id INT PRIMARY KEY DEFAULT 1,
                bot_token VARCHAR(255) NULL,
                chat_id VARCHAR(128) NULL,
                auto_backup_enabled BOOLEAN DEFAULT FALSE,
                backup_frequency VARCHAR(50) DEFAULT 'DAILY',
                last_sent_at TIMESTAMP NULL,
                last_status ENUM('SUCCESS', 'FAILED', 'NONE') DEFAULT 'NONE',
                last_error TEXT NULL,
                last_filename VARCHAR(255) NULL,
                last_file_size INT DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ خشتەی Telegram_Backup_Settings بە سەرکەوتوویی دروستکرا.');

        await db.query(`
            INSERT IGNORE INTO Telegram_Backup_Settings (id, bot_token, chat_id, auto_backup_enabled, backup_frequency)
            VALUES (1, '', '', FALSE, 'DAILY');
        `);
        console.log('✓ داتای بنەڕەتی لە Telegram_Backup_Settings جێگیرکرا.');

        console.log('🎉 مەیگرەیشنی Telegram_Backup_Settings بە سەرکەوتوویی تەواو بوو!');
        process.exit(0);
    } catch (error) {
        console.error('❌ هەڵە لە مەیگرەیشنی تێلیگرام:', error);
        process.exit(1);
    }
}

runMigration();
