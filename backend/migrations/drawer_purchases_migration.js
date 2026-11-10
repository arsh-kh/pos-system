require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');

async function migrate() {
    const connection = await db.getConnection();
    try {
        console.log('--- دەستپێکردنی مەیگرەیشنی پارەی دراو بە کاڵا لە قاسە (Drawer Purchases Migration) ---');
        await connection.beginTransaction();

        // 1. دروستکردنی خشتەی drawer_purchases بۆ تۆماری پارەی دراو بە کاڵا لە قاسە
        await connection.query(`
            CREATE TABLE IF NOT EXISTS drawer_purchases (
                id INT AUTO_INCREMENT PRIMARY KEY,
                shift_id VARCHAR(50) NULL,
                amount BIGINT NOT NULL,
                item_name VARCHAR(255) NOT NULL,
                notes VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✓ خشتەی drawer_purchases دروستکرا/پشکنرا');

        // 2. زیادکردنی ستوونی goods_purchased_cash بۆ خشتەی shifts
        const [shiftCols] = await connection.query('DESCRIBE shifts');
        const shiftColNames = shiftCols.map(c => c.Field);
        if (!shiftColNames.includes('goods_purchased_cash')) {
            await connection.query('ALTER TABLE shifts ADD COLUMN goods_purchased_cash BIGINT DEFAULT 0 AFTER expenses_paid');
            console.log('✓ ستوونی goods_purchased_cash بە سەرکەوتوویی زیادکرا بۆ shifts');
        }

        // 3. تۆمارکردنی مەیگرەیشن لە Schema_Migrations
        await connection.query(
            'INSERT IGNORE INTO Schema_Migrations (migration_name) VALUES (?)',
            ['drawer_purchases_migration.js']
        );

        await connection.commit();
        console.log('✅ مەیگرەیشنی پارەی دراو بە کاڵا بە سەرکەوتوویی جێبەجێکرا');
        process.exit(0);
    } catch (err) {
        await connection.rollback();
        console.error('❌ مەیگرەیشن شکستی هێنا:', err);
        process.exit(1);
    } finally {
        connection.release();
    }
}

migrate();

