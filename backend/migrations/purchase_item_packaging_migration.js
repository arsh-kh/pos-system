const db = require('../db');

async function migrate() {
    console.log('Running Purchase Item Packaging & Precision Migration...');
    try {
        // 1. Add columns to Purchase_Invoice_Items
        const [cols] = await db.query('DESCRIBE Purchase_Invoice_Items');
        const colNames = cols.map(c => c.Field);

        if (!colNames.includes('unit_type')) {
            await db.query("ALTER TABLE Purchase_Invoice_Items ADD COLUMN unit_type VARCHAR(10) DEFAULT 'PIECE'");
            console.log('✓ Added `unit_type` column to `Purchase_Invoice_Items`');
        }
        if (!colNames.includes('box_quantity')) {
            await db.query("ALTER TABLE Purchase_Invoice_Items ADD COLUMN box_quantity DECIMAL(10,3) DEFAULT NULL");
            console.log('✓ Added `box_quantity` column to `Purchase_Invoice_Items`');
        }
        if (!colNames.includes('box_cost_price')) {
            await db.query("ALTER TABLE Purchase_Invoice_Items ADD COLUMN box_cost_price BIGINT DEFAULT NULL");
            console.log('✓ Added `box_cost_price` column to `Purchase_Invoice_Items`');
        }
        if (!colNames.includes('line_total')) {
            await db.query("ALTER TABLE Purchase_Invoice_Items ADD COLUMN line_total BIGINT DEFAULT NULL");
            console.log('✓ Added `line_total` column to `Purchase_Invoice_Items`');
        }

        // 2. Fix specific known invoices with rounding mismatches
        // INV-030975 (4992 -> 5000)
        await db.query("UPDATE Purchase_Invoices SET total_amount = 5000 WHERE invoice_number = 'INV-030975'");
        await db.query("UPDATE Purchase_Invoice_Items SET unit_type = 'BOX', box_quantity = 1, box_cost_price = 5000, line_total = 5000, units_per_box = 24 WHERE invoice_id = 1");

        // INV-535859 (7008 -> 7000)
        await db.query("UPDATE Purchase_Invoices SET total_amount = 7000 WHERE invoice_number = 'INV-535859'");
        await db.query("UPDATE Purchase_Invoice_Items SET unit_type = 'BOX', box_quantity = 1, box_cost_price = 7000, line_total = 7000, units_per_box = 24 WHERE invoice_id = 2");

        // INV-444074 (9504 -> 9500)
        await db.query("UPDATE Purchase_Invoices SET total_amount = 9500 WHERE invoice_number = 'INV-444074'");
        await db.query("UPDATE Purchase_Invoice_Items SET unit_type = 'BOX', box_quantity = 1, box_cost_price = 9500, line_total = 9500, units_per_box = 24 WHERE invoice_id = 3");

        // INV-864777 (25980 -> 26000)
        await db.query("UPDATE Purchase_Invoices SET total_amount = 26000 WHERE invoice_number = 'INV-864777'");
        await db.query("UPDATE Purchase_Invoice_Items SET line_total = 6000, box_quantity = 1, box_cost_price = 6000, unit_type = 'BOX' WHERE id = 22");
        await db.query("UPDATE Purchase_Invoice_Items SET line_total = 10000, box_quantity = 1, box_cost_price = 10000, unit_type = 'BOX' WHERE id = 23");
        await db.query("UPDATE Purchase_Invoice_Items SET line_total = 5000, box_quantity = 1, box_cost_price = 5000, unit_type = 'BOX' WHERE id = 24");
        await db.query("UPDATE Purchase_Invoice_Items SET line_total = 5000, box_quantity = 1, box_cost_price = 5000, unit_type = 'BOX' WHERE id = 25");

        // 3. For any remaining invoice items without line_total, backfill line_total
        await db.query(`
            UPDATE Purchase_Invoice_Items 
            SET line_total = ROUND(cost_price * quantity) 
            WHERE line_total IS NULL
        `);

        // 4. For any purchase invoice where total_amount != (paid_amount + remaining_amount) and additional_cost == 0,
        // synchronize total_amount to paid_amount + remaining_amount
        await db.query(`
            UPDATE Purchase_Invoices 
            SET total_amount = paid_amount + remaining_amount 
            WHERE additional_cost = 0 
              AND total_amount != (paid_amount + remaining_amount)
              AND (paid_amount + remaining_amount) > 0
        `);

        console.log('✓ Migration finished successfully and historical invoices synchronized!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
