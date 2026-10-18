const db = require('../db');
const bcrypt = require('bcryptjs');

async function runMigration() {
  console.log('🔄 دەستپێکردنی مایگرەیشنی بەکارهێنەران و ترایگەرەکانی چاودێری (Multi-Cashier & Audit Triggers)...');

  try {
    // 1. Add full_name and is_active to Users table if they don't exist
    const [cols] = await db.query('SHOW COLUMNS FROM Users');
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('full_name')) {
      console.log('➕ زیادکردنی کێڵگەی full_name بۆ خشتەی Users...');
      await db.query('ALTER TABLE Users ADD COLUMN full_name VARCHAR(150) NULL AFTER username');
    }

    if (!colNames.includes('is_active')) {
      console.log('➕ زیادکردنی کێڵگەی is_active بۆ خشتەی Users...');
      await db.query('ALTER TABLE Users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER role');
    }

    // Set default full_name for existing admin and cashier
    await db.query("UPDATE Users SET full_name = 'بەڕێوەبەری سەرەکی' WHERE username = 'admin' AND (full_name IS NULL OR full_name = '')");
    await db.query("UPDATE Users SET full_name = 'کاشێری ژمارە ١' WHERE username = 'cashier' AND (full_name IS NULL OR full_name = '')");

    // 2. Ensure initial cashiers exist with secure hashed passwords
    const [existingCashiers] = await db.query("SELECT * FROM Users WHERE role = 'CASHIER'");
    if (existingCashiers.length <= 1) {
      console.log('➕ زیادکردنی کاشێری دووەم (cashier2) بە وشەی نهێنی 1234 بۆ نموونە...');
      const salt = await bcrypt.genSalt(10);
      const hash2 = await bcrypt.hash('1234', salt);
      await db.query(`
        INSERT INTO Users (username, full_name, password, role, is_active)
        VALUES ('cashier2', 'کاشێری ژمارە ٢', ?, 'CASHIER', 1)
        ON DUPLICATE KEY UPDATE full_name = VALUES(full_name)
      `, [hash2]);
    }

    // 3. Create Real MySQL Triggers for unforgeable audit logging
    console.log('⚙️ دروستکردنی ترایگەرەکانی داتابەیس (Database Triggers)...');

    // Trigger A: Products Price & Stock change
    await db.query('DROP TRIGGER IF EXISTS trg_products_after_update');
    await db.query(`
      CREATE TRIGGER trg_products_after_update
      AFTER UPDATE ON Products
      FOR EACH ROW
      BEGIN
        IF (OLD.selling_price <> NEW.selling_price OR OLD.cost_price <> NEW.cost_price) THEN
          INSERT INTO Audit_Logs (
            user_id, username, user_role, action_type, entity_name, entity_id,
            old_value, new_value, details, ip_address, created_at
          ) VALUES (
            NULL, 'سیستەم (Trigger)', 'SYSTEM', 'PRICE_CHANGE', 'Products', NEW.id,
            JSON_OBJECT('selling_price', OLD.selling_price, 'cost_price', OLD.cost_price),
            JSON_OBJECT('selling_price', NEW.selling_price, 'cost_price', NEW.cost_price),
            CONCAT('گۆڕانی نرخی کاڵا: ', NEW.name, ' (فرۆشتن: ', OLD.selling_price, ' -> ', NEW.selling_price, ')'),
            '127.0.0.1', NOW()
          );
        END IF;
      END
    `);

    // Trigger B: Products Deletion
    await db.query('DROP TRIGGER IF EXISTS trg_products_after_delete');
    await db.query(`
      CREATE TRIGGER trg_products_after_delete
      AFTER DELETE ON Products
      FOR EACH ROW
      BEGIN
        INSERT INTO Audit_Logs (
          user_id, username, user_role, action_type, entity_name, entity_id,
          old_value, new_value, details, ip_address, created_at
        ) VALUES (
          NULL, 'سیستەم (Trigger)', 'SYSTEM', 'PRODUCT_DELETE', 'Products', OLD.id,
          JSON_OBJECT('barcode', OLD.barcode, 'name', OLD.name, 'stock', OLD.stock, 'selling_price', OLD.selling_price),
          NULL,
          CONCAT('سڕینەوەی کاڵا لە داتابەیس: ', OLD.name, ' (بارکۆد: ', OLD.barcode, ')'),
          '127.0.0.1', NOW()
        );
      END
    `);

    // Trigger C: Sales Deletion
    await db.query('DROP TRIGGER IF EXISTS trg_sales_after_delete');
    await db.query(`
      CREATE TRIGGER trg_sales_after_delete
      AFTER DELETE ON Sales
      FOR EACH ROW
      BEGIN
        INSERT INTO Audit_Logs (
          user_id, username, user_role, action_type, entity_name, entity_id,
          old_value, new_value, details, ip_address, created_at
        ) VALUES (
          NULL, 'سیستەم (Trigger)', 'SYSTEM', 'SALE_DELETE', 'Sales', OLD.id,
          JSON_OBJECT('sale_id', OLD.id, 'total_amount', OLD.total_amount, 'payment_method', OLD.payment_method),
          NULL,
          CONCAT('سڕینەوەی وەسڵی فرۆشتن ژمارە: #', OLD.id, ' بە بڕی ', OLD.total_amount, ' د.ع'),
          '127.0.0.1', NOW()
        );
      END
    `);

    console.log('✅ مایگرەیشنی بەکارهێنەران و ترایگەرەکان بە سەرکەوتوویی تەواو بوو.');
    return true;
  } catch (error) {
    console.error('❌ هەڵە لە ئەنجامدانی مایگرەیشن:', error);
    throw error;
  }
}

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigration };
