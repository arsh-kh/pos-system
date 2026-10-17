const db = require('../db');

async function runMigration() {
    console.log('--- Starting Migration: Purchase Additional Cost (Landed Cost) ---');
    try {
        // 1. Add additional_cost to Purchase_Invoices
        const [invCols] = await db.query("SHOW COLUMNS FROM Purchase_Invoices LIKE 'additional_cost'");
        if (invCols.length === 0) {
            await db.query("ALTER TABLE Purchase_Invoices ADD COLUMN additional_cost BIGINT NOT NULL DEFAULT 0 AFTER payment_method");
            console.log('✓ Added `additional_cost` column to `Purchase_Invoices`');
        } else {
            console.log('• `additional_cost` column already exists in `Purchase_Invoices`');
        }

        // 2. Add landed_cost_price to Purchase_Invoice_Items
        const [itemCols] = await db.query("SHOW COLUMNS FROM Purchase_Invoice_Items LIKE 'landed_cost_price'");
        if (itemCols.length === 0) {
            await db.query("ALTER TABLE Purchase_Invoice_Items ADD COLUMN landed_cost_price BIGINT DEFAULT NULL AFTER cost_price");
            console.log('✓ Added `landed_cost_price` column to `Purchase_Invoice_Items`');
        } else {
            console.log('• `landed_cost_price` column already exists in `Purchase_Invoice_Items`');
        }

        console.log('--- Migration Completed Successfully ---');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

runMigration();
