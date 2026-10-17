require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');

async function runMigration() {
    console.log('--- دەستپێکردنی مەیگرەیشنی سیستەمی FIFO و وەجبەکانی کۆگا (FIFO Batches Migration) ---');
    try {
        // 1. Create Product_Batches table
        await db.query(`
            CREATE TABLE IF NOT EXISTS Product_Batches (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id INT NOT NULL,
                purchase_invoice_id INT NULL,
                batch_number VARCHAR(100) NULL,
                initial_quantity DECIMAL(10, 3) NOT NULL,
                remaining_quantity DECIMAL(10, 3) NOT NULL,
                cost_price BIGINT NOT NULL,
                selling_price BIGINT NULL,
                expiry_date DATE NULL,
                status ENUM('ACTIVE', 'EXHAUSTED') DEFAULT 'ACTIVE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_product_active (product_id, status, remaining_quantity),
                INDEX idx_created_at (created_at),
                FOREIGN KEY (product_id) REFERENCES Products(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ خشتەی Product_Batches بە سەرکەوتوویی دروستکرا یان پێشتر هەبوو.');

        // 2. Create Sale_Item_Batches table
        await db.query(`
            CREATE TABLE IF NOT EXISTS Sale_Item_Batches (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sale_id INT NOT NULL,
                sale_item_id INT NOT NULL,
                batch_id INT NOT NULL,
                quantity_deducted DECIMAL(10, 3) NOT NULL,
                unit_cost_price BIGINT NOT NULL,
                total_cost BIGINT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_sale_id (sale_id),
                INDEX idx_sale_item_id (sale_item_id),
                INDEX idx_batch_id (batch_id),
                FOREIGN KEY (batch_id) REFERENCES Product_Batches(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ خشتەی Sale_Item_Batches بە سەرکەوتوویی دروستکرا یان پێشتر هەبوو.');

        // 3. Auto-seed initial batches for existing products with stock > 0
        const [existingProducts] = await db.query(`
            SELECT p.id, p.name, p.stock, p.cost_price, p.selling_price, p.created_at
            FROM Products p
            WHERE p.stock > 0
        `);

        let seededCount = 0;
        for (const prod of existingProducts) {
            const [batchCheck] = await db.query(
                'SELECT id FROM Product_Batches WHERE product_id = ? LIMIT 1',
                [prod.id]
            );

            if (batchCheck.length === 0) {
                await db.query(`
                    INSERT INTO Product_Batches (
                        product_id, 
                        batch_number, 
                        initial_quantity, 
                        remaining_quantity, 
                        cost_price, 
                        selling_price, 
                        status, 
                        created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
                `, [
                    prod.id,
                    `INIT-STOCK-${prod.id}`,
                    prod.stock,
                    prod.stock,
                    BigInt(Math.round(Number(prod.cost_price) || 0)).toString(),
                    BigInt(Math.round(Number(prod.selling_price) || 0)).toString(),
                    prod.created_at || new Date()
                ]);
                seededCount++;
            }
        }

        console.log(`✓ مەخزەنی پێشووی کاڵاکان بە سەرکەوتوویی گوازرایەوە بۆ سیستەمی FIFO: ${seededCount} وەجبەی سەرەتایی دروستکران.`);
        console.log('--- مەیگرەیشنی FIFO بە تەواوی سەرکەوتوو بوو ---');
        process.exit(0);
    } catch (error) {
        console.error('❌ هەڵە لە مەیگرەیشنی FIFO:', error.message);
        process.exit(1);
    }
}

runMigration();
