require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');

async function migrate() {
  const connection = await db.getConnection();
  try {
    console.log('--- دەستپێکردنی مەیگرەیشنی فرە-جۆری پارەدان (Split Payment Migration) ---');
    await connection.beginTransaction();

    // 1. پشکنین و زیادکردنی ستوونەکان بۆ خشتەی Sales
    const [salesCols] = await connection.query('DESCRIBE Sales');
    const salesColNames = salesCols.map(c => c.Field);

    if (!salesColNames.includes('paid_amount')) {
      await connection.query('ALTER TABLE Sales ADD COLUMN paid_amount BIGINT NOT NULL DEFAULT 0 AFTER discount_amount');
      console.log('✓ ستوونی paid_amount بە سەرکەوتوویی زیادکرا بۆ Sales');
    }

    if (!salesColNames.includes('debt_amount')) {
      await connection.query('ALTER TABLE Sales ADD COLUMN debt_amount BIGINT NOT NULL DEFAULT 0 AFTER paid_amount');
      console.log('✓ ستوونی debt_amount بە سەرکەوتوویی زیادکرا بۆ Sales');
    }

    if (!salesColNames.includes('payment_method')) {
      await connection.query("ALTER TABLE Sales ADD COLUMN payment_method ENUM('CASH', 'DEBT', 'SPLIT') NOT NULL DEFAULT 'CASH' AFTER debt_amount");
      console.log('✓ ستوونی payment_method بە سەرکەوتوویی زیادکرا بۆ Sales');
    }

    // 2. پشکنین و زیادکردنی ستوونەکان بۆ خشتەی Customer_Debts
    const [debtCols] = await connection.query('DESCRIBE Customer_Debts');
    const debtColNames = debtCols.map(c => c.Field);

    if (!debtColNames.includes('sale_id')) {
      await connection.query('ALTER TABLE Customer_Debts ADD COLUMN sale_id INT NULL AFTER customer_id');
      console.log('✓ ستوونی sale_id بە سەرکەوتوویی زیادکرا بۆ Customer_Debts');
    }

    if (!debtColNames.includes('note')) {
      await connection.query('ALTER TABLE Customer_Debts ADD COLUMN note VARCHAR(255) NULL AFTER transaction_type');
      console.log('✓ ستوونی note بە سەرکەوتوویی زیادکرا بۆ Customer_Debts');
    }

    // 3. ڕێکخستنی فرۆشتنەکانی پێشوو بەپێی بەڵگەنامەکان
    // ئەگەر پسووڵەیەکی پێشوو هەبێت کە paid_amount = 0 و debt_amount = 0 بێت:
    await connection.query(`
      UPDATE Sales 
      SET paid_amount = total_amount, payment_method = 'CASH' 
      WHERE paid_amount = 0 AND debt_amount = 0 AND total_amount > 0
    `);
    console.log('✓ داتای پسووڵەکانی پێشوو بە سەرکەوتوویی گونجێندران');

    await connection.commit();
    console.log('=== مەیگرەیشنەکە بە سەرکەوتوویی ١٠٠٪ تەواو بوو! ===');
    process.exit(0);
  } catch (error) {
    await connection.rollback();
    console.error('Migration Failed:', error);
    process.exit(1);
  } finally {
    connection.release();
  }
}

migrate();
