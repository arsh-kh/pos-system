const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function initDb() {
    try {
        console.log('Connecting to MySQL without database context...');
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            multipleStatements: true
        });

        console.log('Reading schema.sql...');
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('Executing schema...');
        await connection.query(schema);
        
        console.log('Database initialized successfully.');
        await connection.end();
        process.exit(0);
    } catch (error) {
        console.error('Failed to initialize database:', error);
        process.exit(1);
    }
}

initDb();
