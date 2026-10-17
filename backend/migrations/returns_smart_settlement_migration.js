require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');

async function migrate() {
  const connection = await db.getConnection();
  try {
    console.log('--- دەستپێکردنی مەیگرەیشنی زیرەکی گەڕاندنەوە (Smart Returns Migration) ---');
    await connection.beginTransaction();

    const [cols] = await connection.query('DESCRIBE Returns');
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('refund_method')) {
      await connection.query("ALTER TABLE Returns ADD COLUMN refund_method ENUM('CASH', 'DEBT') NOT NULL DEFAULT 'CASH' AFTER refunded_amount");
      console.log('✓ ستوونی refund_method بە سەرکەوتوویی زیادکرا بۆ Returns');
    }

    if (!colNames.includes('customer_id')) {
      await connection.query('ALTER TABLE Returns ADD COLUMN customer_id INT NULL AFTER refund_method');
      console.log('✓ ستوونی customer_id بە سەرکەوتوویی زیادکرا بۆ Returns');
    }

    if (!colNames.includes('debt_transaction_id')) {
      await connection.query('ALTER TABLE Returns ADD COLUMN debt_transaction_id INT NULL AFTER customer_id');
      console.log('✓ ستوونی debt_transaction_id بە سەرکەوتوویی زیادکرا بۆ Returns');
    }

    // Link customer_id to existing returns where possible based on Sales
    await connection.query(`
      UPDATE Returns r
      JOIN Sales s ON r.sale_id = s.id
      SET r.customer_id = s.customer_id
      WHERE r.customer_id IS NULL AND s.customer_id IS NOT NULL
    `);
    console.log('✓ کڕیارە کۆنەکان بە سەرکەوتوویی گرێدرانەوە بە گەڕاندنەوەکانی پێشوو');

    await connection.commit();
    console.log('=== مەیگرەیشنی زیرەکی گەڕاندنەوە بە سەرکەوتوویی ١٠٠٪ تەواو بوو! ===');
    process.exit(0);
  } catch (err) {
    await connection.rollback();
    console.error('Migration Failed:', err);
    process.exit(1);
  } finally {
    connection.release();
  }
}

migrate();
