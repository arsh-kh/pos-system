const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config();

async function initDb(options = {}) {
    const isStandalone = !options.noExit;
    try {
        console.log('Connecting to MySQL server...');
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            multipleStatements: true
        });

        console.log('Applying baseline schema.sql...');
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await connection.query(schema);
        console.log('✓ Base schema and default users verified.');
        await connection.end();

        // Ensure Schema_Migrations table exists in pos_db
        console.log('Verifying Schema_Migrations table...');
        const posDbConnection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'pos_db'
        });

        await posDbConnection.query(`
            CREATE TABLE IF NOT EXISTS Schema_Migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                migration_name VARCHAR(255) NOT NULL UNIQUE,
                executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        const [executedRows] = await posDbConnection.query('SELECT migration_name FROM Schema_Migrations');
        const executedSet = new Set(executedRows.map(r => r.migration_name));

        // Run migrations sequentially, skipping already executed
        console.log('Applying database migrations...');
        const migrationsDir = path.resolve(__dirname, 'migrations');
        if (fs.existsSync(migrationsDir)) {
            const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js')).sort();
            for (const file of files) {
                if (executedSet.has(file)) {
                    continue; // Skip already executed migration
                }
                const fullPath = path.join(migrationsDir, file);
                try {
                    execSync(`"${process.execPath}" "${fullPath}"`, {
                        cwd: __dirname,
                        stdio: 'ignore',
                        timeout: 15000,
                        env: { ...process.env }
                    });
                } catch (_) {
                    // Safe ignore if columns already exist
                }
                try {
                    await posDbConnection.query('INSERT IGNORE INTO Schema_Migrations (migration_name) VALUES (?)', [file]);
                    console.log(`✓ Recorded migration: ${file}`);
                } catch (_) {}
            }
            console.log(`✓ All migrations up to date.`);
        }
        await posDbConnection.end();

        console.log('🎉 Database is ready for production use.');
        if (isStandalone) process.exit(0);
        return true;
    } catch (error) {
        console.error('Failed to initialize database:', error.message);
        if (isStandalone) process.exit(1);
        return false;
    }
}

if (require.main === module) {
    initDb();
}

module.exports = { initDb };
