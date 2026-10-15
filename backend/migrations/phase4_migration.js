require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');

async function migrate() {
  try {
    const [cols] = await db.query('DESCRIBE Expenses');
    const names = cols.map(c => c.Field);
    
    if (!names.includes('title')) {
      await db.query('ALTER TABLE Expenses ADD COLUMN title VARCHAR(255) DEFAULT NULL AFTER id');
      await db.query('UPDATE Expenses SET title = description WHERE title IS NULL');
      console.log('Added title column');
    }
    if (!names.includes('category')) {
      await db.query("ALTER TABLE Expenses ADD COLUMN category VARCHAR(100) DEFAULT 'هەمەجۆر' AFTER title");
      console.log('Added category column');
    }
    if (!names.includes('expense_date')) {
      await db.query('ALTER TABLE Expenses ADD COLUMN expense_date DATE DEFAULT NULL AFTER amount');
      await db.query('UPDATE Expenses SET expense_date = DATE(created_at) WHERE expense_date IS NULL');
      console.log('Added expense_date column');
    }
    if (!names.includes('notes')) {
      await db.query('ALTER TABLE Expenses ADD COLUMN notes TEXT NULL AFTER expense_date');
      console.log('Added notes column');
    }

    const [newCols] = await db.query('DESCRIBE Expenses');
    console.table(newCols.map(c => ({ Field: c.Field, Type: c.Type })));
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrate();
