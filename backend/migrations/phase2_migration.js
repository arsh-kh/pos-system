require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');

async function migrate() {
  try {
    // 1. Add discount columns to Sales
    const [salesCols] = await db.query('DESCRIBE Sales');
    const colNames = salesCols.map(c => c.Field);
    if (!colNames.includes('discount_amount')) {
      await db.query('ALTER TABLE Sales ADD COLUMN discount_amount BIGINT DEFAULT 0 AFTER total_profit');
      console.log('Added discount_amount to Sales');
    }
    if (!colNames.includes('subtotal_amount')) {
      await db.query('ALTER TABLE Sales ADD COLUMN subtotal_amount BIGINT DEFAULT 0 AFTER total_profit');
      console.log('Added subtotal_amount to Sales');
    }

    // 2. Change quantity in Sale_Items to DECIMAL(10,3)
    await db.query('ALTER TABLE Sale_Items MODIFY COLUMN quantity DECIMAL(10,3) NOT NULL DEFAULT 1.000');
    console.log('Modified Sale_Items.quantity to DECIMAL(10,3)');

    // 3. Change stock in Products to DECIMAL(10,3)
    await db.query('ALTER TABLE Products MODIFY COLUMN stock DECIMAL(10,3) NOT NULL DEFAULT 0.000');
    console.log('Modified Products.stock to DECIMAL(10,3)');

    // 4. Add unit to Products if not present
    const [prodCols] = await db.query('DESCRIBE Products');
    if (!prodCols.map(c => c.Field).includes('unit')) {
      await db.query("ALTER TABLE Products ADD COLUMN unit VARCHAR(50) DEFAULT 'دانە'");
      console.log('Added unit to Products');
    }

    console.log('Phase 2 DB migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrate();
