require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');

async function migrate() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS Cashier_Permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        permission_key VARCHAR(100) NOT NULL UNIQUE,
        category ENUM('MODULE', 'POS_ACTION') NOT NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        label_ku VARCHAR(255) NOT NULL,
        description_ku VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_perm_key (permission_key),
        INDEX idx_perm_cat (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Initial default seed permissions
    const defaultPermissions = [
      // 1. Dashboard Modules
      ['pos_cashier', 'MODULE', 1, 'کاشێر و فرۆشتن', 'ڕێگەدان بە کردنەوەی شاشەی سەرەکی فرۆشتن و کاشێر'],
      ['pos_shifts', 'MODULE', 1, 'قاسە و شیفتەکان', 'ڕێگەدان بە بینینی باڵانسی قاسە و داخستنی شیفت'],
      ['pos_owes', 'MODULE', 1, 'قەرزەکانی کڕیاران', 'ڕێگەدان بە بینینی قەرزی کڕیاران و وەرگرتنەوەی قیست'],
      ['pos_returns', 'MODULE', 1, 'گەڕاندنەوەی کاڵا', 'ڕێگەدان بە گەڕاندنەوەی کاڵا لە کڕیار و گەڕاندنەوەی پارە'],
      ['inv_products', 'MODULE', 1, 'کاڵاکان و مەخزەن', 'ڕێگەدان بە بینین و گەڕان بەدوای کاڵاکان و نرخەکان'],
      ['inv_needs', 'MODULE', 1, 'پێداویستییەکان', 'ڕێگەدان بە تۆمارکردنی کەمبوونی کاڵا لە مارکێت'],
      ['inv_promotions', 'MODULE', 0, 'ئۆفەر و داشکاندن', 'ڕێگەدان بە دروستکردنی ئۆفەر و داشکاندنی گشتی'],
      ['inv_purchases', 'MODULE', 0, 'پسووڵەی کڕین', 'ڕێگەدان بە تۆمارکردنی پسووڵەی کڕین لە کۆمپانیاکان'],
      ['inv_audit', 'MODULE', 0, 'جەردکردنی کۆگا', 'ڕێگەدان بە ئەنجامدانی جەردی کۆگا و مەخزەن'],
      ['inv_wastage', 'MODULE', 0, 'زیان و فەوتان', 'ڕێگەدان بە تۆمارکردنی کاڵای بەسەرچوو یان شکاو'],
      ['inv_vendor_returns', 'MODULE', 0, 'گەڕاندنەوە بۆ کۆمپانیا', 'ڕێگەدان بە گەڕاندنەوەی کاڵا بۆ دابینکەر (RTV)'],
      ['mgmt_expenses', 'MODULE', 0, 'خەرجییەکان', 'ڕێگەدان بە تۆمارکردنی خەرجییەکانی مارکێت'],
      ['mgmt_history', 'MODULE', 0, 'مێژووی فرۆشتن', 'ڕێگەدان بە گەڕان بەناو فرۆشتن و پسووڵە کۆنەکان'],

      // 2. POS Cashier Screen Actions
      ['allow_manual_discount', 'POS_ACTION', 1, 'داشکاندنی دەستی لەسەر پسووڵە', 'ڕێگەدان بە کاشێر بۆ دانانی داشکاندن (تخفیض) لەسەر پسووڵە'],
      ['allow_custom_price', 'POS_ACTION', 0, 'دەستکاریکردنی نرخی فرۆشتنی کاڵا', 'ڕێگەدان بە کاشێر بۆ دەستکاریکردنی نرخی تاک لە سەلەدا'],
      ['allow_delete_item', 'POS_ACTION', 1, 'سڕینەوەی کاڵا لە سەلەدا', 'ڕێگەدان بە سڕینەوەی کاڵای سکانکراو لەناو سەلەی فرۆشتندا'],
      ['allow_clear_cart', 'POS_ACTION', 1, 'سڕینەوەی تەواوی سەلە', 'ڕێگەدان بە بەتاڵکردنەوەی هەموو سەلەکە بە یەکجار'],
      ['allow_debt_sale', 'POS_ACTION', 1, 'فرۆشتن بە شێوازی قەرز', 'ڕێگەدان بە تەواوکردنی پسووڵە بە قەرز بۆ کڕیار'],
      ['allow_split_payment', 'POS_ACTION', 1, 'پارەدانی بەش بەش (نەقد + قەرز)', 'ڕێگەدان بە جیاکردنەوەی بڕی نەقد و قەرز لە یەک پسووڵەدا'],
      ['allow_view_cost_price', 'POS_ACTION', 0, 'بینینی نرخی کڕین و قازانج', 'پیشاندانی نرخی کڕین (تێچوو) و قازانج بۆ کاشێر']
    ];

    for (const [key, cat, enabled, label, desc] of defaultPermissions) {
      await db.query(`
        INSERT INTO Cashier_Permissions (permission_key, category, is_enabled, label_ku, description_ku)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          label_ku = VALUES(label_ku),
          description_ku = VALUES(description_ku)
      `, [key, cat, enabled, label, desc]);
    }

    console.log('Cashier_Permissions table and seed data created successfully!');
    if (require.main === module) process.exit(0);
  } catch (err) {
    console.error('Cashier_Permissions migration error:', err);
    if (require.main === module) process.exit(1);
    throw err;
  }
}

if (require.main === module) {
  migrate();
}

module.exports = migrate;
