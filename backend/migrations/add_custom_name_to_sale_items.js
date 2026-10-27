const db = require('../db');

async function migrate() {
    try {
        console.log('Running migration: add_custom_name_to_sale_items...');
        const [columns] = await db.query("SHOW COLUMNS FROM Sale_Items LIKE 'custom_name'");
        if (columns.length === 0) {
            await db.query("ALTER TABLE Sale_Items ADD COLUMN custom_name VARCHAR(255) NULL AFTER price_at_sale");
            console.log('✓ Added custom_name column to Sale_Items');
        } else {
            console.log('ℹ custom_name column already exists in Sale_Items');
        }
        process.exit(0);
    } catch (err) {
        console.error('Migration error:', err.message);
        process.exit(1);
    }
}

migrate();
