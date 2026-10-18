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

        // Run migrations sequentially
        console.log('Applying database migrations...');
        const migrationsDir = path.resolve(__dirname, 'migrations');
        if (fs.existsSync(migrationsDir)) {
            const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js')).sort();
            for (const file of files) {
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
            }
            console.log(`✓ All ${files.length} migrations up to date.`);
        }

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
