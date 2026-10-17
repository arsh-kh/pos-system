const db = require('../db');
const fs = require('fs');
const path = require('path');
const { logAuditAction } = require('../middleware/auditLogger');

const BACKUPS_DIR = path.resolve(__dirname, '../backups');

// Ensure backups directory exists
if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Helper to safely serialize BigInt and dates
const safeJsonStringify = (data) => {
    return JSON.stringify(data, (key, value) => {
        if (typeof value === 'bigint') {
            return value.toString();
        }
        return value;
    }, 2);
};

/**
 * Get Database Overview & Statistics
 * GET /api/backup/stats
 */
exports.getBackupStats = async (req, res) => {
    try {
        const [tables] = await db.query('SHOW TABLES');
        const dbNameKey = Object.keys(tables[0] || {})[0] || 'Tables_in_pos_db';
        const tableNames = tables.map(t => t[dbNameKey]);

        const tableStats = [];
        let totalRows = 0;

        for (const tbl of tableNames) {
            try {
                const [countRes] = await db.query(`SELECT COUNT(*) as cnt FROM \`${tbl}\``);
                const count = countRes[0]?.cnt || 0;
                totalRows += count;
                tableStats.push({ name: tbl, rowCount: count });
            } catch (err) {
                tableStats.push({ name: tbl, rowCount: 0 });
            }
        }

        // Check local backups directory
        let localBackups = [];
        try {
            const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.json'));
            localBackups = files.map(file => {
                const filePath = path.join(BACKUPS_DIR, file);
                const stats = fs.statSync(filePath);
                return {
                    filename: file,
                    sizeBytes: stats.size,
                    createdAt: stats.mtime
                };
            }).sort((a, b) => b.createdAt - a.createdAt);
        } catch (_) {}

        res.json({
            status: 'SUCCESS',
            data: {
                totalTables: tableNames.length,
                totalRows,
                tables: tableStats,
                localBackupsCount: localBackups.length,
                latestBackup: localBackups[0] || null
            }
        });
    } catch (error) {
        console.error('Backup Stats Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Download & Snapshot Full Database Backup
 * GET /api/backup
 */
exports.downloadBackup = async (req, res) => {
    try {
        const [tables] = await db.query('SHOW TABLES');
        if (!tables || tables.length === 0) {
            return res.status(500).json({ status: 'ERROR', message: 'هیچ خشتەیەک لە داتابەیسدا نەدۆزرایەوە' });
        }

        const dbNameKey = Object.keys(tables[0])[0];
        const tableNames = tables.map(t => t[dbNameKey]);

        const backupData = {
            metadata: {
                version: '2.0',
                exported_at: new Date().toISOString(),
                database: process.env.DB_NAME || 'pos_db',
                total_tables: tableNames.length,
                table_counts: {}
            },
            schemas: {},
            tables: {}
        };

        for (const tbl of tableNames) {
            // 1. Export table DDL schema for self-contained restore
            try {
                const [schemaRes] = await db.query(`SHOW CREATE TABLE \`${tbl}\``);
                if (schemaRes && schemaRes[0]) {
                    const keys = Object.keys(schemaRes[0]);
                    backupData.schemas[tbl] = schemaRes[0]['Create Table'] || schemaRes[0][keys[1]];
                }
            } catch (_) {}

            // 2. Export table data rows
            try {
                const [rows] = await db.query(`SELECT * FROM \`${tbl}\``);
                backupData.tables[tbl] = rows;
                backupData.metadata.table_counts[tbl] = rows.length;
            } catch (err) {
                console.warn(`Warning: Could not backup table ${tbl}:`, err.message);
                backupData.tables[tbl] = [];
                backupData.metadata.table_counts[tbl] = 0;
            }
        }

        const jsonString = safeJsonStringify(backupData);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `pos_backup_${timestamp}.json`;

        // Save server snapshot in backend/backups/
        try {
            const localFilePath = path.join(BACKUPS_DIR, filename);
            fs.writeFileSync(localFilePath, jsonString, 'utf8');

            // Rotate: keep only the latest 10 snapshots to save disk
            const existingFiles = fs.readdirSync(BACKUPS_DIR)
                .filter(f => f.endsWith('.json'))
                .map(f => ({ name: f, time: fs.statSync(path.join(BACKUPS_DIR, f)).mtime.getTime() }))
                .sort((a, b) => b.time - a.time);

            if (existingFiles.length > 10) {
                existingFiles.slice(10).forEach(f => {
                    try { fs.unlinkSync(path.join(BACKUPS_DIR, f.name)); } catch (_) {}
                });
            }
        } catch (snapErr) {
            console.warn('Could not write server local snapshot:', snapErr.message);
        }

        // Audit log backup export
        await logAuditAction({
            req,
            action_type: 'BACKUP_CREATED',
            entity_name: 'Database',
            entity_id: 1,
            new_value: backupData.metadata,
            details: `داگرتنی باکئەپی تەواوی داتابەیس (${tableNames.length} خشتە، پەڕگەی ${filename})`
        });

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(jsonString);
    } catch (error) {
        console.error('Backup Download Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Create Manual Snapshot on Server (without client download)
 * POST /api/backup/create-snapshot
 */
exports.createManualSnapshot = async (req, res) => {
    try {
        const { note } = req.body || {};
        const [tables] = await db.query('SHOW TABLES');
        if (!tables || tables.length === 0) {
            return res.status(500).json({ status: 'ERROR', message: 'هیچ خشتەیەک لە داتابەیسدا نەدۆزرایەوە' });
        }

        const dbNameKey = Object.keys(tables[0])[0];
        const tableNames = tables.map(t => t[dbNameKey]);

        const backupData = {
            metadata: {
                version: '2.0',
                type: 'MANUAL_SERVER_SNAPSHOT',
                note: note || 'کۆپی دەستی سەر سێرڤەر',
                exported_at: new Date().toISOString(),
                database: process.env.DB_NAME || 'pos_db',
                total_tables: tableNames.length,
                table_counts: {}
            },
            schemas: {},
            tables: {}
        };

        for (const tbl of tableNames) {
            try {
                const [schemaRes] = await db.query(`SHOW CREATE TABLE \`${tbl}\``);
                if (schemaRes && schemaRes[0]) {
                    const keys = Object.keys(schemaRes[0]);
                    backupData.schemas[tbl] = schemaRes[0]['Create Table'] || schemaRes[0][keys[1]];
                }
            } catch (_) {}

            try {
                const [rows] = await db.query(`SELECT * FROM \`${tbl}\``);
                backupData.tables[tbl] = rows;
                backupData.metadata.table_counts[tbl] = rows.length;
            } catch (err) {
                backupData.tables[tbl] = [];
                backupData.metadata.table_counts[tbl] = 0;
            }
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `pos_manual_${timestamp}.json`;
        const localFilePath = path.join(BACKUPS_DIR, filename);
        fs.writeFileSync(localFilePath, safeJsonStringify(backupData), 'utf8');

        // Audit log
        await logAuditAction({
            req,
            action_type: 'BACKUP_CREATED',
            entity_name: 'Database',
            entity_id: 1,
            new_value: backupData.metadata,
            details: `دروستکردنی کۆپییەکی دەستی لەسەر سێرڤەر: ${filename} (${tableNames.length} خشتە)`
        });

        res.json({
            status: 'SUCCESS',
            message: 'کۆپی یەدەگ بە سەرکەوتوویی لەسەر سێرڤەر دروستکرا',
            data: {
                filename,
                sizeBytes: fs.statSync(localFilePath).size,
                createdAt: new Date(),
                metadata: backupData.metadata
            }
        });
    } catch (error) {
        console.error('Manual Snapshot Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Delete a local snapshot from server
 * DELETE /api/backup/snapshots/:filename
 */
exports.deleteLocalSnapshot = async (req, res) => {
    try {
        const { filename } = req.params;
        if (!filename || !/^[a-zA-Z0-9_\-\.]+\.json$/.test(filename)) {
            return res.status(400).json({ status: 'ERROR', message: 'ناوی پەڕگە نادروستە' });
        }

        const filePath = path.join(BACKUPS_DIR, filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ status: 'ERROR', message: 'پەڕگەکە نەدۆزرایەوە' });
        }

        fs.unlinkSync(filePath);

        await logAuditAction({
            req,
            action_type: 'BACKUP_DELETED',
            entity_name: 'Database',
            entity_id: 1,
            details: `سڕینەوەی باکئەپی سەر سێرڤەر: ${filename}`
        });

        res.json({ status: 'SUCCESS', message: 'پەڕگەی باکئەپ بە سەرکەوتوویی سڕدرایەوە' });
    } catch (error) {
        console.error('Delete Snapshot Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * List Local Server Snapshots
 * GET /api/backup/local-snapshots
 */
exports.listLocalSnapshots = async (req, res) => {
    try {
        if (!fs.existsSync(BACKUPS_DIR)) {
            return res.json({ status: 'SUCCESS', data: [] });
        }

        const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.json'));
        const snapshots = files.map(filename => {
            const fullPath = path.join(BACKUPS_DIR, filename);
            const stats = fs.statSync(fullPath);
            let metadata = null;
            try {
                const headContent = fs.readFileSync(fullPath, 'utf8').slice(0, 2048);
                const metaMatch = headContent.match(/"metadata"\s*:\s*({[\s\S]*?}),\s*"(tables|schemas)"/);
                if (metaMatch) {
                    metadata = JSON.parse(metaMatch[1]);
                }
            } catch (_) {}

            return {
                filename,
                sizeBytes: stats.size,
                createdAt: stats.mtime,
                metadata
            };
        }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({ status: 'SUCCESS', data: snapshots });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

// Ensure Audit_Logs supports any action_type
(async () => {
    try {
        await db.query("ALTER TABLE Audit_Logs MODIFY COLUMN action_type VARCHAR(50) NOT NULL");
    } catch (_) {}
})();

/**
 * Restore Database from Backup Payload
 * POST /api/backup/restore
 */
exports.restoreBackup = async (req, res) => {
    const rawData = req.body.backupData || req.body;

    if (!rawData || typeof rawData !== 'object') {
        return res.status(400).json({ status: 'ERROR', message: 'فایلی باکئەپ دروست نییە یان داتاکەی بەتاڵە' });
    }

    // Support both direct table dictionary or { metadata, tables, schemas }
    const tablesData = rawData.tables || rawData;
    const schemasData = rawData.schemas || null;
    const tableKeys = Object.keys(tablesData).filter(k => k !== 'metadata' && k !== 'exported_at' && k !== 'schemas');

    if (tableKeys.length === 0) {
        return res.status(400).json({ status: 'ERROR', message: 'هیچ خشتەیەک لەناو ئەم باکئەپەدا نەدۆزرایەوە' });
    }

    const connection = await db.getConnection();
    try {
        // Disable foreign keys check for safe bulk restoration
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        await connection.beginTransaction();

        // 1. If table schemas are present in backup, create missing tables if restoring to a fresh DB
        if (schemasData && typeof schemasData === 'object') {
            for (const [tbl, createSql] of Object.entries(schemasData)) {
                if (/^[a-zA-Z0-9_]+$/.test(tbl) && typeof createSql === 'string') {
                    let safeSql = createSql.trim();
                    if (!safeSql.toUpperCase().includes('CREATE TABLE IF NOT EXISTS')) {
                        safeSql = safeSql.replace(/^CREATE\s+TABLE\s+/i, 'CREATE TABLE IF NOT EXISTS ');
                    }
                    try {
                        await connection.query(safeSql);
                    } catch (schemaErr) {
                        console.warn(`Notice on table ${tbl} create:`, schemaErr.message);
                    }
                }
            }
        }

        // Fetch existing database tables to validate against
        const [existingTablesRes] = await connection.query('SHOW TABLES');
        const dbKey = Object.keys(existingTablesRes[0] || {})[0];
        const validTableNames = new Set(existingTablesRes.map(t => t[dbKey].toLowerCase()));

        // Filter keys to only valid existing database tables
        const validKeys = tableKeys.filter(k => validTableNames.has(k.toLowerCase()));

        if (validKeys.length === 0) {
            await connection.rollback();
            await connection.query('SET FOREIGN_KEY_CHECKS = 1');
            return res.status(400).json({ status: 'ERROR', message: 'پەڕگەی باکئەپ هیچ خشتەیەکی باوەڕپێکراوی سیستەمی تێدا نییە' });
        }

        let restoredTableCount = 0;
        let restoredRowCount = 0;
        const restoredSummary = {};

        for (const tbl of validKeys) {
            // Security whitelist check: only alphanumeric and underscores
            if (!/^[a-zA-Z0-9_]+$/.test(tbl)) {
                continue;
            }

            const rows = Array.isArray(tablesData[tbl]) ? tablesData[tbl] : [];

            // 1. Clear existing rows in table
            await connection.query(`DELETE FROM \`${tbl}\``);

            // 2. Insert rows in chunks of 100 to avoid packet size overflow
            if (rows.length > 0) {
                const chunkSize = 100;
                for (let i = 0; i < rows.length; i += chunkSize) {
                    const chunk = rows.slice(i, i + chunkSize);
                    if (chunk.length === 0) continue;

                    // Extract all column names from first object of chunk
                    const columns = Object.keys(chunk[0]);
                    if (columns.length === 0) continue;

                    const escapedCols = columns.map(c => `\`${c}\``).join(', ');
                    
                    const valuePlaceholders = chunk.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
                    const flatValues = [];

                    for (const row of chunk) {
                        for (const col of columns) {
                            let val = row[col];
                            // Format MySQL dates if ISO string
                            if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
                                val = new Date(val);
                            } else if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
                                // Serialize objects/arrays to valid JSON string for MySQL JSON columns
                                val = JSON.stringify(val);
                            }
                            flatValues.push(val === undefined ? null : val);
                        }
                    }

                    const queryStr = `INSERT INTO \`${tbl}\` (${escapedCols}) VALUES ${valuePlaceholders}`;
                    await connection.query(queryStr, flatValues);
                }
            }

            // 3. Reset auto-increment counter to max(id) + 1 to prevent ID collisions on subsequent inserts
            try {
                const [maxRes] = await connection.query(`SELECT MAX(id) as max_id FROM \`${tbl}\``);
                const maxId = maxRes[0]?.max_id;
                if (maxId && Number(maxId) > 0) {
                    await connection.query(`ALTER TABLE \`${tbl}\` AUTO_INCREMENT = ${Number(maxId) + 1}`);
                }
            } catch (_) {}

            restoredTableCount++;
            restoredRowCount += rows.length;
            restoredSummary[tbl] = rows.length;
        }

        await connection.commit();
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');

        // Audit log restoration
        await logAuditAction({
            req,
            action_type: 'RESTORE_APPLIED',
            entity_name: 'Database',
            entity_id: 1,
            new_value: { restoredTableCount, restoredRowCount, summary: restoredSummary },
            details: `هێنانەوەی باکئەپی داتابەیس: ${restoredTableCount} خشتە و ${restoredRowCount} دێڕ داتا بە سەرکەوتوویی هێنرانەوە`
        });

        res.json({
            status: 'SUCCESS',
            message: 'باکئەپەکە بە سەرکەوتوویی لەسەر داتابەیس جێبەجێکرا',
            data: {
                restoredTableCount,
                restoredRowCount,
                summary: restoredSummary
            }
        });
    } catch (error) {
        await connection.rollback();
        try { await connection.query('SET FOREIGN_KEY_CHECKS = 1'); } catch (_) {}
        console.error('Database Restore Error:', error);
        res.status(500).json({ status: 'ERROR', message: 'هەڵە لە کاتی هێنانەوەی باکئەپ: ' + error.message });
    } finally {
        connection.release();
    }
};

/**
 * Restore from a server local snapshot
 * POST /api/backup/restore-local
 */
exports.restoreFromLocal = async (req, res) => {
    const { filename } = req.body;
    if (!filename || !/^[a-zA-Z0-9_\-\.]+\.json$/.test(filename)) {
        return res.status(400).json({ status: 'ERROR', message: 'ناوی پەڕگە نادروستە' });
    }

    const filePath = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ status: 'ERROR', message: 'پەڕگەی باکئەپ نەدۆزرایەوە' });
    }

    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const backupData = JSON.parse(fileContent);
        req.body = { backupData };
        return exports.restoreBackup(req, res);
    } catch (err) {
        return res.status(500).json({ status: 'ERROR', message: 'هەڵە لە خوێندنەوەی پەڕگە: ' + err.message });
    }
};

/**
 * Download specific server local snapshot file
 * GET /api/backup/download-snapshot/:filename
 */
exports.downloadLocalSnapshot = async (req, res) => {
    const { filename } = req.params;
    if (!filename || !/^[a-zA-Z0-9_\-\.]+\.json$/.test(filename)) {
        return res.status(400).json({ status: 'ERROR', message: 'ناوی پەڕگە نادروستە' });
    }

    const filePath = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ status: 'ERROR', message: 'پەڕگەی باکئەپ نەدۆزرایەوە' });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
};

/**
 * Automated Silent Local Snapshot Engine
 * Runs periodically to ensure store data is never lost even if manual export is forgotten.
 */
const performAutoSnapshot = async () => {
    try {
        // Check when the latest snapshot was taken
        if (fs.existsSync(BACKUPS_DIR)) {
            const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.json'));
            if (files.length > 0) {
                const latestFile = files
                    .map(f => ({ name: f, time: fs.statSync(path.join(BACKUPS_DIR, f)).mtime.getTime() }))
                    .sort((a, b) => b.time - a.time)[0];

                const hoursSinceLast = (Date.now() - latestFile.time) / (1000 * 60 * 60);
                // If a backup was taken within the last 12 hours, skip
                if (hoursSinceLast < 12) {
                    return;
                }
            }
        }

        const [tables] = await db.query('SHOW TABLES');
        if (!tables || tables.length === 0) return;

        const dbNameKey = Object.keys(tables[0])[0];
        const tableNames = tables.map(t => t[dbNameKey]);

        const backupData = {
            metadata: {
                version: '2.0',
                type: 'AUTO_DAILY_SNAPSHOT',
                exported_at: new Date().toISOString(),
                database: process.env.DB_NAME || 'pos_db',
                total_tables: tableNames.length,
                table_counts: {}
            },
            schemas: {},
            tables: {}
        };

        for (const tbl of tableNames) {
            try {
                const [schemaRes] = await db.query(`SHOW CREATE TABLE \`${tbl}\``);
                if (schemaRes && schemaRes[0]) {
                    const keys = Object.keys(schemaRes[0]);
                    backupData.schemas[tbl] = schemaRes[0]['Create Table'] || schemaRes[0][keys[1]];
                }
            } catch (_) {}

            try {
                const [rows] = await db.query(`SELECT * FROM \`${tbl}\``);
                backupData.tables[tbl] = rows;
                backupData.metadata.table_counts[tbl] = rows.length;
            } catch (_) {
                backupData.tables[tbl] = [];
            }
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `pos_auto_backup_${timestamp}.json`;
        const localFilePath = path.join(BACKUPS_DIR, filename);
        fs.writeFileSync(localFilePath, safeJsonStringify(backupData), 'utf8');
        console.log(`✓ Automated daily backup snapshot created: ${filename}`);

        // Automatically dispatch to Telegram if configured
        try {
            const { dispatchAutoTelegramBackup } = require('./telegram_backup');
            dispatchAutoTelegramBackup(filename, localFilePath, backupData);
        } catch (tgErr) {
            console.warn('Auto Telegram dispatch notice:', tgErr.message);
        }

        // Rotate: keep latest 14 snapshots
        const existingFiles = fs.readdirSync(BACKUPS_DIR)
            .filter(f => f.endsWith('.json'))
            .map(f => ({ name: f, time: fs.statSync(path.join(BACKUPS_DIR, f)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time);

        if (existingFiles.length > 14) {
            existingFiles.slice(14).forEach(f => {
                try { fs.unlinkSync(path.join(BACKUPS_DIR, f.name)); } catch (_) {}
            });
        }
    } catch (err) {
        console.warn('Auto snapshot error:', err.message);
    }
};

// Schedule automated daily snapshots: check on startup and every 6 hours
setTimeout(performAutoSnapshot, 5000);
setInterval(performAutoSnapshot, 6 * 60 * 60 * 1000);

