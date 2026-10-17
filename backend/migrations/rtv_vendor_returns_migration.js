require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');

async function runMigration() {
    console.log('--- دەستپێکردنی مەیگرەیشنی گەڕاندنەوە بۆ کۆمپانیا (RTV Migration) ---');
    try {
        const [cols] = await db.query('DESCRIBE Purchase_Returns');
        const colNames = cols.map(c => c.Field);

        if (!colNames.includes('unit_type')) {
            await db.query("ALTER TABLE Purchase_Returns ADD COLUMN unit_type ENUM('PIECE', 'BOX') DEFAULT 'PIECE' AFTER product_id");
            console.log('✓ ستوونی unit_type زیادکرا بۆ Purchase_Returns');
        }

        if (!colNames.includes('units_multiplier')) {
            await db.query("ALTER TABLE Purchase_Returns ADD COLUMN units_multiplier DECIMAL(10, 3) DEFAULT 1.000 AFTER unit_type");
            console.log('✓ ستوونی units_multiplier زیادکرا بۆ Purchase_Returns');
        }

        if (!colNames.includes('representative_name')) {
            await db.query("ALTER TABLE Purchase_Returns ADD COLUMN representative_name VARCHAR(100) NULL AFTER reason");
            console.log('✓ ستوونی representative_name (ناوی مەندوب) زیادکرا بۆ Purchase_Returns');
        }

        if (!colNames.includes('created_by_username')) {
            await db.query("ALTER TABLE Purchase_Returns ADD COLUMN created_by_username VARCHAR(100) NULL AFTER representative_name");
            console.log('✓ ستوونی created_by_username زیادکرا بۆ Purchase_Returns');
        }

        if (!colNames.includes('notes')) {
            await db.query("ALTER TABLE Purchase_Returns ADD COLUMN notes TEXT NULL AFTER created_by_username");
            console.log('✓ ستوونی notes زیادکرا بۆ Purchase_Returns');
        }

        console.log('--- مەیگرەیشنی RTV بە سەرکەوتوویی کۆتایی هات ---');
        process.exit(0);
    } catch (error) {
        console.error('❌ هەڵە لە مەیگرەیشنی RTV:', error.message);
        process.exit(1);
    }
}

runMigration();
