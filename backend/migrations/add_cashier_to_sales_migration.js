const db = require('../db');

async function migrate() {
    try {
        console.log('--- Starting Migration: Add Cashier to Sales ---');
        
        // 1. Check user_id column
        const [userIdCol] = await db.query("SHOW COLUMNS FROM Sales LIKE 'user_id'");
        if (userIdCol.length === 0) {
            console.log('Adding user_id column to Sales table...');
            await db.query(`
                ALTER TABLE Sales 
                ADD COLUMN user_id INT NULL 
                AFTER customer_id
            `);
            try {
                await db.query(`
                    ALTER TABLE Sales 
                    ADD CONSTRAINT fk_sales_user 
                    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE SET NULL
                `);
            } catch (fkErr) {
                console.warn('FK constraint notice:', fkErr.message);
            }
            console.log('✓ Added user_id column.');
        } else {
            console.log('✓ user_id column already exists.');
        }

        // 2. Check cashier_name column
        const [cashierCol] = await db.query("SHOW COLUMNS FROM Sales LIKE 'cashier_name'");
        if (cashierCol.length === 0) {
            console.log('Adding cashier_name column to Sales table...');
            await db.query(`
                ALTER TABLE Sales 
                ADD COLUMN cashier_name VARCHAR(100) NULL 
                AFTER user_id
            `);
            console.log('✓ Added cashier_name column.');
        } else {
            console.log('✓ cashier_name column already exists.');
        }

        // 3. Backfill existing sales with default admin / main cashier name
        console.log('Backfilling existing sales with default cashier name...');
        const [updateRes] = await db.query(`
            UPDATE Sales 
            SET cashier_name = 'بەڕێوەبەری سەرەکی'
            WHERE cashier_name IS NULL OR cashier_name = ''
        `);
        console.log(`✓ Backfilled ${updateRes.affectedRows} sales with default cashier name.`);

        console.log('--- Migration Completed Successfully ---');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
