require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require('dotenv').config();
const db = require('../db');

async function migrate() {
    try {
        console.log('--- Starting supplier_soft_unlink_migration ---');

        // 1. Modify supplier_id in Purchase_Invoices to allow NULL
        try {
            await db.query("ALTER TABLE Purchase_Invoices MODIFY COLUMN supplier_id INT NULL");
            console.log('✓ Modified Purchase_Invoices.supplier_id to allow NULL');
        } catch (e) {
            console.warn('Note modifying supplier_id:', e.message);
        }

        // 2. Update foreign key on Purchase_Invoices to ON DELETE SET NULL
        try {
            await db.query("ALTER TABLE Purchase_Invoices DROP FOREIGN KEY purchase_invoices_ibfk_1");
        } catch (_) {}
        try {
            await db.query("ALTER TABLE Purchase_Invoices ADD CONSTRAINT purchase_invoices_ibfk_1 FOREIGN KEY (supplier_id) REFERENCES Suppliers(id) ON DELETE SET NULL");
            console.log('✓ Updated purchase_invoices_ibfk_1 to ON DELETE SET NULL');
        } catch (e) {
            console.warn('Note setting FK:', e.message);
        }

        // 3. Safely delete supplier 'پشتیوان باناسیاو' (ID: 1) if it exists
        // Unlink any invoice to preserve historical stock & sales
        await db.query("UPDATE Purchase_Invoices SET supplier_id = NULL WHERE supplier_id = 1");
        try {
            await db.query("UPDATE Purchase_Returns SET supplier_id = NULL WHERE supplier_id = 1");
        } catch (_) {}
        await db.query("DELETE FROM Suppliers WHERE id = 1 OR name = 'پشتیوان باناسیاو'");
        console.log('✓ Safely unlinked invoices and deleted supplier پشتیوان باناسیاو.');

        console.log('✓ supplier_soft_unlink_migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
