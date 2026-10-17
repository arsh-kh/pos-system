require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');

async function runMigration() {
    console.log('--- دەستپێکردنی مەیگرەیشنی سیستەمی هاوکاتکردنی ئۆفلاین و ئۆنلاین (Sync Migration) ---');
    try {
        // 1. Create Sync_Queue table
        await db.query(`
            CREATE TABLE IF NOT EXISTS Sync_Queue (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sync_id VARCHAR(64) NOT NULL UNIQUE,
                entity_type VARCHAR(50) NOT NULL,
                entity_id VARCHAR(64) NOT NULL,
                action_type VARCHAR(20) NOT NULL,
                payload JSON NOT NULL,
                status ENUM('PENDING', 'SYNCING', 'SYNCED', 'FAILED') DEFAULT 'PENDING',
                retry_count INT DEFAULT 0,
                error_message TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                synced_at TIMESTAMP NULL,
                INDEX idx_sync_status (status),
                INDEX idx_sync_created (created_at),
                INDEX idx_entity (entity_type, entity_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ خشتەی Sync_Queue بە سەرکەوتوویی دروستکرا.');

        // 2. Create Sync_Settings table
        await db.query(`
            CREATE TABLE IF NOT EXISTS Sync_Settings (
                id INT PRIMARY KEY DEFAULT 1,
                cloud_url VARCHAR(255) DEFAULT 'http://localhost:3001/api/cloud-sync',
                api_key VARCHAR(128) NULL,
                auto_sync_enabled BOOLEAN DEFAULT TRUE,
                sync_interval_seconds INT DEFAULT 15,
                last_successful_sync TIMESTAMP NULL,
                last_ping_status ENUM('ONLINE', 'OFFLINE') DEFAULT 'ONLINE',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ خشتەی Sync_Settings بە سەرکەوتوویی دروستکرا.');

        // 3. Ensure default settings row exists
        await db.query(`
            INSERT IGNORE INTO Sync_Settings (id, cloud_url, auto_sync_enabled, sync_interval_seconds, last_ping_status)
            VALUES (1, 'http://localhost:3001/api/cloud-sync', TRUE, 15, 'ONLINE');
        `);
        console.log('✓ ڕێکخستنی بنەڕەتی لە Sync_Settings جێگیرکرا.');

        // 4. Create Cloud_Received_Records table for Cloud-side idempotency tracking
        await db.query(`
            CREATE TABLE IF NOT EXISTS Cloud_Received_Records (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sync_id VARCHAR(64) NOT NULL UNIQUE,
                entity_type VARCHAR(50) NOT NULL,
                entity_id VARCHAR(64) NOT NULL,
                action_type VARCHAR(20) NOT NULL,
                received_payload JSON NOT NULL,
                received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_cloud_entity (entity_type, entity_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ خشتەی Cloud_Received_Records بۆ وەرگرتنی کلاود بە سەرکەوتوویی دروستکرا.');

        console.log('--- مەیگرەیشنی Sync بە سەرکەوتوویی تەواو بوو ---');
        process.exit(0);
    } catch (error) {
        console.error('❌ هەڵە لە مەیگرەیشنی Sync:', error.message);
        process.exit(1);
    }
}

runMigration();
