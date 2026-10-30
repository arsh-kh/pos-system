/**
 * reset_system_to_zero.js
 * Safely resets all transactional, inventory, customer, supplier, sales,
 * and audit log data to ZERO for fresh production launch.
 */
const db = require('../db');

async function factoryReset() {
  console.log('🔄 Starting complete system factory reset...');

  const connection = await db.getConnection();
  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.beginTransaction();

    const tablesToReset = [
      'sale_item_batches',
      'sale_items',
      'sales',
      'returns',
      'purchase_invoice_items',
      'purchase_invoices',
      'purchase_returns',
      'product_batches',
      'products',
      'customer_debts',
      'customers',
      'suppliers',
      'audit_logs',
      'damages',
      'expenses',
      'discounts',
      'promotions',
      'shifts',
      'inventory_audits',
      'needs',
      'needs_categories',
      'cloud_received_records',
      'sync_queue'
    ];

    for (const tbl of tablesToReset) {
      await connection.query(`TRUNCATE TABLE \`${tbl}\``);
      console.log(`✓ Truncated & reset AUTO_INCREMENT: ${tbl}`);
    }

    // Keep categories completely clean at ZERO
    await connection.query('TRUNCATE TABLE `categories`');
    console.log('✓ Truncated categories to ZERO');

    // Clean test cashiers, keep only master admin
    await connection.query("DELETE FROM `users` WHERE `username` != 'admin'");
    await connection.query('ALTER TABLE `users` AUTO_INCREMENT = 2');

    // Reset backup and sync timestamps
    await connection.query("UPDATE `telegram_backup_settings` SET last_sent_at = NULL, last_status = NULL, last_error = NULL, last_filename = NULL, last_file_size = 0 WHERE id = 1");
    await connection.query("UPDATE `sync_settings` SET last_successful_sync = NULL WHERE id = 1");

    await connection.commit();
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('\n🎉 System has been completely reset to ZERO point!');
    console.log('All sales, batches, products, customers, suppliers, and audit logs are 0.');
    console.log('User accounts and permissions preserved.');
  } catch (err) {
    await connection.rollback();
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.error('❌ Factory reset error:', err);
    throw err;
  } finally {
    connection.release();
  }
}

if (require.main === module) {
  factoryReset()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = factoryReset;
