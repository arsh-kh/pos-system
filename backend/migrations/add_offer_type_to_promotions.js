const db = require('../db');

async function migrate() {
    try {
        console.log('Checking offer_type column in Promotions table...');
        const [cols] = await db.query("SHOW COLUMNS FROM Promotions LIKE 'offer_type'");
        if (cols.length === 0) {
            await db.query(`
                ALTER TABLE Promotions 
                ADD COLUMN offer_type ENUM('UNIT_DISCOUNT', 'BUNDLE_PACKAGE') NOT NULL DEFAULT 'UNIT_DISCOUNT' 
                AFTER discount_type
            `);
            console.log('Added offer_type column to Promotions successfully.');
        } else {
            console.log('offer_type column already exists in Promotions.');
        }
        process.exit(0);
    } catch (err) {
        console.error('Migration error:', err);
        process.exit(1);
    }
}

migrate();
