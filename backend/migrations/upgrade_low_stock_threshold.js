require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');

async function runMigration() {
    console.log('=== دەستپێکردنی نوێکردنەوەی ستوونی low_stock_threshold بۆ DECIMAL(10,3) ===');
    try {
        await db.query(`
            ALTER TABLE Products 
            MODIFY COLUMN low_stock_threshold DECIMAL(10,3) DEFAULT 5.000
        `);
        console.log('✓ ستوونی low_stock_threshold بە سەرکەوتوویی کرا بە DECIMAL(10,3)');
        process.exit(0);
    } catch (err) {
        console.error('هەڵە لە نوێکردنەوەی ستوون:', err);
        process.exit(1);
    }
}

runMigration();
