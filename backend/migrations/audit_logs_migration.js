require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');
const bcrypt = require('bcryptjs');

async function migrate() {
  try {
    console.log('Starting Audit_Logs and Users migration...');

    // 1. Create Audit_Logs table
    await db.query(`
      CREATE TABLE IF NOT EXISTS Audit_Logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        username VARCHAR(100) NOT NULL,
        user_role VARCHAR(50) NOT NULL DEFAULT 'CASHIER',
        action_type ENUM(
          'PRICE_CHANGE', 
          'STOCK_ADJUSTMENT', 
          'PRODUCT_EDIT', 
          'PRODUCT_DELETE',
          'SALE_DELETE', 
          'REFUND_RETURN', 
          'EXPENSE_CREATE', 
          'EXPENSE_DELETE',
          'SHIFT_OPEN', 
          'SHIFT_CLOSE', 
          'DISCOUNT_APPLIED'
        ) NOT NULL,
        entity_name VARCHAR(100) NOT NULL,
        entity_id VARCHAR(100) NULL,
        old_value JSON NULL,
        new_value JSON NULL,
        details TEXT NULL,
        ip_address VARCHAR(50) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_action (action_type),
        INDEX idx_user (username),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('Audit_Logs table verified/created.');

    // 2. Ensure default users exist (admin and cashier)
    const [existingUsers] = await db.query('SELECT * FROM Users WHERE username IN (?, ?)', ['admin', 'cashier']);
    const usernames = existingUsers.map(u => u.username);

    if (!usernames.includes('admin')) {
      const hashedAdminPw = await bcrypt.hash('admin123', 10);
      await db.query(
        'INSERT INTO Users (username, password, role) VALUES (?, ?, ?)',
        ['admin', hashedAdminPw, 'ADMIN']
      );
      console.log('Created default admin user (admin / admin123)');
    }

    if (!usernames.includes('cashier')) {
      const hashedCashierPw = await bcrypt.hash('1234', 10);
      await db.query(
        'INSERT INTO Users (username, password, role) VALUES (?, ?, ?)',
        ['cashier', hashedCashierPw, 'CASHIER']
      );
      console.log('Created default cashier user (cashier / 1234)');
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
