require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');

async function runMigration() {
    console.log('--- دەستپێکردنی مەیگرەیشنی خشتەی جەردی کۆگا (Inventory Audits Migration) ---');
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS Inventory_Audits (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id INT NOT NULL,
                product_name VARCHAR(255) NOT NULL,
                barcode VARCHAR(100) NULL,
                unit_type ENUM('PIECE', 'BOX') DEFAULT 'PIECE',
                units_multiplier DECIMAL(10, 3) DEFAULT 1.000,
                system_stock DECIMAL(10, 3) NOT NULL,
                counted_stock DECIMAL(10, 3) NOT NULL,
                difference_qty DECIMAL(10, 3) NOT NULL,
                cost_price BIGINT NOT NULL,
                total_cost_discrepancy BIGINT NOT NULL,
                status ENUM('MATCH', 'SHORTAGE', 'SURPLUS') NOT NULL DEFAULT 'MATCH',
                damage_id INT NULL,
                audited_by_username VARCHAR(100) NULL,
                notes TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_product_id (product_id),
                INDEX idx_created_at (created_at),
                INDEX idx_status (status),
                FOREIGN KEY (product_id) REFERENCES Products(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        console.log('✓ خشتەی Inventory_Audits بە سەرکەوتوویی دروستکرا یان پێشتر هەبوو.');

        const [tables] = await db.query("SHOW TABLES LIKE 'Inventory_Audits'");
        if (tables.length > 0) {
            console.log('✓ دڵنیابوونەوە لە بوونی خشتەی Inventory_Audits لە داتابەیسدا: تێپەڕی');
        }

        console.log('--- مەیگرەیشنی Inventory Audits بە سەرکەوتوویی کۆتایی هات ---');
        process.exit(0);
    } catch (error) {
        console.error('❌ هەڵە لە مەیگرەیشنی Inventory Audits:', error.message);
        process.exit(1);
    }
}

runMigration();
