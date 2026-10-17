require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');

async function runMigration() {
    console.log('--- دەستپێکردنی مەیگرەیشنی خشتەی زیان و فەوتان (Damages Migration) ---');
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS Damages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id INT NOT NULL,
                barcode VARCHAR(100) NULL,
                product_name VARCHAR(255) NOT NULL,
                unit_type ENUM('PIECE', 'BOX') DEFAULT 'PIECE',
                units_multiplier DECIMAL(10, 3) DEFAULT 1.000,
                quantity DECIMAL(10, 3) NOT NULL,
                cost_price BIGINT NOT NULL,
                total_cost_loss BIGINT NOT NULL,
                reason ENUM('EXPIRED', 'BROKEN', 'DAMAGED', 'THEFT_OR_LOST', 'OTHER') NOT NULL DEFAULT 'DAMAGED',
                reason_label VARCHAR(100) NOT NULL DEFAULT 'تێکچوو / کەموکوڕی',
                notes TEXT NULL,
                created_by_user_id INT NULL,
                created_by_username VARCHAR(100) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_product_id (product_id),
                INDEX idx_created_at (created_at),
                INDEX idx_reason (reason),
                FOREIGN KEY (product_id) REFERENCES Products(id) ON DELETE RESTRICT
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        console.log('✓ خشتەی Damages بە سەرکەوتوویی دروستکرا یان پێشتر هەبوو.');

        const [tables] = await db.query(`SHOW TABLES LIKE 'Damages'`);
        if (tables.length > 0) {
            console.log('✓ دڵنیابوونەوە لە بوونی خشتەی Damages لە داتابەیسدا: تێپەڕی');
        }

        console.log('--- مەیگرەیشنی Damages بە سەرکەوتوویی کۆتایی هات ---');
        process.exit(0);
    } catch (error) {
        console.error('❌ هەڵە لە مەیگرەیشنی Damages:', error.message);
        process.exit(1);
    }
}

runMigration();
