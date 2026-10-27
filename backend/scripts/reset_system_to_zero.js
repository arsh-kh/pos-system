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

    // Keep categories clean or reset categories
    await connection.query('TRUNCATE TABLE `categories`');
    console.log('✓ Truncated categories');

    // Insert clean initial standard categories
    const initialCategories = [
      'خواردنەوەکان',
      'شیرینی و پسکیت',
      'خۆراکی گشتی',
      'سەوزە و میوە',
      'شۆردەر و پاککەرەوە',
      'ئەلیکترۆنی و کەلوپەل'
    ];
    for (const cat of initialCategories) {
      await connection.query('INSERT INTO `categories` (name) VALUES (?)', [cat]);
    }
    console.log(`✓ Seeded ${initialCategories.length} clean standard categories`);

    // Reset AUTO_INCREMENT on users if needed, but preserve existing user accounts
    await connection.query('ALTER TABLE `users` AUTO_INCREMENT = 4');

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
