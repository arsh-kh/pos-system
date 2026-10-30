/**
 * financial_audit_fixes_migration.js
 * 
 * Migration adding missing schema columns for:
 * 1. Customers.notes
 * 2. Shifts.debt_repaid_cash & Shifts.cash_refunds
 * 3. Making Returns.sale_id NULLABLE for direct returns
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');

async function migrate() {
  console.log('Running Financial Audit Fixes Migration...');
  try {
    // 1. Customers.notes
    const [cCols] = await db.query('DESCRIBE Customers');
    if (!cCols.some(c => c.Field === 'notes')) {
      await db.query('ALTER TABLE Customers ADD COLUMN notes VARCHAR(255) NULL');
      console.log('✓ Added notes column to Customers table');
    }

    // 2. Shifts columns
    const [sCols] = await db.query('DESCRIBE Shifts');
    if (!sCols.some(c => c.Field === 'debt_repaid_cash')) {
      await db.query('ALTER TABLE Shifts ADD COLUMN debt_repaid_cash BIGINT DEFAULT 0');
      console.log('✓ Added debt_repaid_cash column to Shifts table');
    }
    if (!sCols.some(c => c.Field === 'cash_refunds')) {
      await db.query('ALTER TABLE Shifts ADD COLUMN cash_refunds BIGINT DEFAULT 0');
      console.log('✓ Added cash_refunds column to Shifts table');
    }

    // 3. Returns.sale_id NULLABLE
    try {
      await db.query('ALTER TABLE Returns MODIFY COLUMN sale_id INT NULL');
      console.log('✓ Modified Returns.sale_id column to be NULLABLE');
    } catch (err) {
      console.warn('Notice regarding Returns.sale_id:', err.message);
    }

    console.log('✓ Financial Audit Fixes Migration completed successfully!');
    if (require.main === module) process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    if (require.main === module) process.exit(1);
    throw err;
  }
}

if (require.main === module) {
  migrate();
}

module.exports = migrate;

