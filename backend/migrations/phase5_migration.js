require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');

async function migrate() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS Shifts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cashier_name VARCHAR(100) DEFAULT 'کاشێری سەرەکی',
        opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP NULL DEFAULT NULL,
        opening_cash BIGINT DEFAULT 0,
        cash_sales BIGINT DEFAULT 0,
        debt_sales BIGINT DEFAULT 0,
        expenses_paid BIGINT DEFAULT 0,
        expected_cash BIGINT DEFAULT 0,
        actual_cash BIGINT DEFAULT 0,
        difference BIGINT DEFAULT 0,
        status VARCHAR(50) DEFAULT 'OPEN',
        notes TEXT NULL
      )
    `);
    console.log('Created Shifts table successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrate();
