require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');

async function migrate() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS Promotions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        discount_type ENUM('FIXED_PRICE', 'PERCENT') DEFAULT 'FIXED_PRICE',
        discount_value DECIMAL(10,2) NOT NULL,
        max_qty_per_sale DECIMAL(10,3) DEFAULT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        notes VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_promo_dates (start_date, end_date, is_active),
        INDEX idx_promo_product (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('Promotions table created successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Promotions migration error:', err);
    process.exit(1);
  }
}

migrate();
