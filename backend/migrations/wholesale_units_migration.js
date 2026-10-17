require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');

async function migrate() {
  try {
    console.log('Starting wholesale & carton units migration...');

    // 1. Add box_barcode to Products
    try {
      await db.query(`ALTER TABLE Products ADD COLUMN box_barcode VARCHAR(100) NULL UNIQUE`);
      console.log('✓ Added box_barcode column to Products');
    } catch (err) {
      if (err.message.includes('Duplicate column')) {
        console.log('ℹ box_barcode column already exists in Products');
      } else {
        console.error('Error adding box_barcode to Products:', err.message);
      }
    }

    // 2. Add units_per_box to Products
    try {
      await db.query(`ALTER TABLE Products ADD COLUMN units_per_box DECIMAL(10,3) NOT NULL DEFAULT 1.000`);
      console.log('✓ Added units_per_box column to Products');
    } catch (err) {
      if (err.message.includes('Duplicate column')) {
        console.log('ℹ units_per_box column already exists in Products');
      } else {
        console.error('Error adding units_per_box to Products:', err.message);
      }
    }

    // 3. Add unit_type and units_per_box to Sale_Items
    try {
      await db.query(`ALTER TABLE Sale_Items ADD COLUMN unit_type ENUM('PIECE', 'BOX') NOT NULL DEFAULT 'PIECE'`);
      console.log('✓ Added unit_type column to Sale_Items');
    } catch (err) {
      if (err.message.includes('Duplicate column')) {
        console.log('ℹ unit_type column already exists in Sale_Items');
      } else {
        console.error('Error adding unit_type to Sale_Items:', err.message);
      }
    }

    try {
      await db.query(`ALTER TABLE Sale_Items ADD COLUMN units_per_box DECIMAL(10,3) NOT NULL DEFAULT 1.000`);
      console.log('✓ Added units_per_box column to Sale_Items');
    } catch (err) {
      if (err.message.includes('Duplicate column')) {
        console.log('ℹ units_per_box column already exists in Sale_Items');
      } else {
        console.error('Error adding units_per_box to Sale_Items:', err.message);
      }
    }

    // 4. Add unit_type and units_multiplier to Returns
    try {
      await db.query(`ALTER TABLE Returns ADD COLUMN unit_type ENUM('PIECE', 'BOX') NOT NULL DEFAULT 'PIECE'`);
      console.log('✓ Added unit_type column to Returns');
    } catch (err) {
      if (err.message.includes('Duplicate column')) {
        console.log('ℹ unit_type column already exists in Returns');
      } else {
        console.error('Error adding unit_type to Returns:', err.message);
      }
    }

    try {
      await db.query(`ALTER TABLE Returns ADD COLUMN units_multiplier DECIMAL(10,3) NOT NULL DEFAULT 1.000`);
      console.log('✓ Added units_multiplier column to Returns');
    } catch (err) {
      if (err.message.includes('Duplicate column')) {
        console.log('ℹ units_multiplier column already exists in Returns');
      } else {
        console.error('Error adding units_multiplier to Returns:', err.message);
      }
    }

    console.log('Wholesale & carton units migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Wholesale & carton units migration error:', err);
    process.exit(1);
  }
}

migrate();
