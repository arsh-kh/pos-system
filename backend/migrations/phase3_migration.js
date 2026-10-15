require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');

async function migrate() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS Purchase_Returns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        supplier_id INT NULL,
        product_id INT NOT NULL,
        quantity DECIMAL(10,3) NOT NULL,
        cost_price BIGINT NOT NULL,
        total_refund BIGINT NOT NULL,
        refund_type VARCHAR(50) DEFAULT 'DEBT_DEDUCT',
        reason VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES Suppliers(id) ON DELETE SET NULL,
        FOREIGN KEY (product_id) REFERENCES Products(id) ON DELETE CASCADE
      )
    `);
    console.log('Created Purchase_Returns table successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrate();
