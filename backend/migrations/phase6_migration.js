require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');

async function migrate() {
  try {
    // 1. Modify quantity to DECIMAL(10,3) to support weighted items
    try {
      await db.query(`ALTER TABLE Returns MODIFY COLUMN quantity DECIMAL(10,3) NOT NULL`);
      console.log('Modified Returns.quantity to DECIMAL(10,3)');
    } catch (err) {
      console.log('quantity column already modified or error:', err.message);
    }

    // 2. Add reason column if not exists
    try {
      await db.query(`ALTER TABLE Returns ADD COLUMN reason VARCHAR(255) NULL`);
      console.log('Added reason column to Returns');
    } catch (err) {
      if (!err.message.includes('Duplicate column')) {
        console.log('reason column info:', err.message);
      }
    }

    console.log('Phase 6 migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Phase 6 migration error:', err);
    process.exit(1);
  }
}

migrate();
