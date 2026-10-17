const db = require('../db');

async function runMigration() {
    console.log('--- Starting Migration: Comprehensive Codebase Audit Fixes ---');
    try {
        // 1. Modify Purchase_Invoice_Items.quantity to DECIMAL(10,3) for fractional weights
        try {
            await db.query("ALTER TABLE Purchase_Invoice_Items MODIFY COLUMN quantity DECIMAL(10,3) NOT NULL DEFAULT 1.000");
            await db.query("ALTER TABLE Purchase_Invoice_Items MODIFY COLUMN selling_price BIGINT DEFAULT NULL");
            console.log('✓ Upgraded `Purchase_Invoice_Items.quantity` to DECIMAL(10,3) and selling_price to DEFAULT NULL');
        } catch (err) {
            console.warn('• Note on Purchase_Invoice_Items modify:', err.message);
        }

        // 2. Add performance index on Sales(created_at)
        try {
            const [indexes] = await db.query("SHOW INDEX FROM Sales WHERE Key_name = 'idx_sales_created_at'");
            if (indexes.length === 0) {
                await db.query("CREATE INDEX idx_sales_created_at ON Sales(created_at)");
                console.log('✓ Added index `idx_sales_created_at` on Sales');
            } else {
                console.log('• Index `idx_sales_created_at` already exists');
            }
        } catch (err) {
            console.warn('• Note on idx_sales_created_at:', err.message);
        }

        // 3. Add performance index on Expenses(created_at)
        try {
            const [indexes] = await db.query("SHOW INDEX FROM Expenses WHERE Key_name = 'idx_expenses_created_at'");
            if (indexes.length === 0) {
                await db.query("CREATE INDEX idx_expenses_created_at ON Expenses(created_at)");
                console.log('✓ Added index `idx_expenses_created_at` on Expenses');
            } else {
                console.log('• Index `idx_expenses_created_at` already exists');
            }
        } catch (err) {
            console.warn('• Note on idx_expenses_created_at:', err.message);
        }

        // 4. Add performance index on Returns(created_at)
        try {
            const [indexes] = await db.query("SHOW INDEX FROM Returns WHERE Key_name = 'idx_returns_created_at'");
            if (indexes.length === 0) {
                await db.query("CREATE INDEX idx_returns_created_at ON Returns(created_at)");
                console.log('✓ Added index `idx_returns_created_at` on Returns');
            } else {
                console.log('• Index `idx_returns_created_at` already exists');
            }
        } catch (err) {
            console.warn('• Note on idx_returns_created_at:', err.message);
        }

        // 5. Add performance index on Purchase_Invoices(created_at)
        try {
            const [indexes] = await db.query("SHOW INDEX FROM Purchase_Invoices WHERE Key_name = 'idx_purchase_invoices_created_at'");
            if (indexes.length === 0) {
                await db.query("CREATE INDEX idx_purchase_invoices_created_at ON Purchase_Invoices(created_at)");
                console.log('✓ Added index `idx_purchase_invoices_created_at` on Purchase_Invoices');
            } else {
                console.log('• Index `idx_purchase_invoices_created_at` already exists');
            }
        } catch (err) {
            console.warn('• Note on idx_purchase_invoices_created_at:', err.message);
        }

        // 6. Ensure CUSTOM_ITEM product exists for manual cashier sales
        try {
            const [customRows] = await db.query("SELECT id FROM Products WHERE barcode = 'CUSTOM_ITEM'");
            if (customRows.length === 0) {
                await db.query(`
                    INSERT INTO Products (name, barcode, cost_price, selling_price, stock, unit)
                    VALUES ('کاڵای دەستی / گشتی', 'CUSTOM_ITEM', 0, 0, 999999, 'دانە')
                `);
                console.log('✓ Created placeholder product for CUSTOM_ITEM');
            } else {
                console.log('• Placeholder product for CUSTOM_ITEM already exists');
            }
        } catch (err) {
            console.warn('• Note on CUSTOM_ITEM placeholder:', err.message);
        }

        console.log('--- Migration Completed Successfully ---');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

runMigration();
