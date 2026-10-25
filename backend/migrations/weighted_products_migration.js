require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');

async function migrate() {
  try {
    const [cols] = await db.query('DESCRIBE Products');
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('is_weighted')) {
      await db.query('ALTER TABLE Products ADD COLUMN is_weighted TINYINT(1) NOT NULL DEFAULT 0');
      console.log('Added is_weighted to Products');
    }

    if (!colNames.includes('unit')) {
      await db.query("ALTER TABLE Products ADD COLUMN unit VARCHAR(50) DEFAULT 'دانە'");
      console.log('Added unit to Products');
    }

    if (!colNames.includes('wholesale_price')) {
      await db.query('ALTER TABLE Products ADD COLUMN wholesale_price BIGINT NOT NULL DEFAULT 0');
      console.log('Added wholesale_price to Products');
    }

    if (!colNames.includes('expiry_date')) {
      await db.query('ALTER TABLE Products ADD COLUMN expiry_date DATE NULL');
      console.log('Added expiry_date to Products');
    }

    if (!colNames.includes('low_stock_threshold')) {
      await db.query('ALTER TABLE Products ADD COLUMN low_stock_threshold INT NOT NULL DEFAULT 5');
      console.log('Added low_stock_threshold to Products');
    }

    console.log('Weighted products migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrate();
