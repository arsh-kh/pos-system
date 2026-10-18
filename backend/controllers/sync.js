const db = require('../db');
const net = require('net');
const http = require('http');
const https = require('https');
const { logAuditAction } = require('../middleware/auditLogger');

// Helper to safely serialize BigInt and dates
const safeJsonStringify = (data) => {
    return JSON.stringify(data, (key, value) => {
        if (typeof value === 'bigint') {
            return value.toString();
        }
        return value;
    });
};

let cachedNetStatus = null;
let lastNetCheckTime = 0;

/**
 * Fast & Reliable Network Connectivity Probe
 * Checks true internet reachability via HTTPS endpoints (Telegram API / Cloudflare / Google)
 * avoiding ISP port 53 firewall blocks, with a 6-second short cache.
 */
const checkRealInternetConnectivity = async () => {
    const now = Date.now();
    if (cachedNetStatus !== null && (now - lastNetCheckTime < 6000)) {
        return cachedNetStatus;
    }

    const testEndpoints = [
        'https://api.telegram.org',
        'http://www.google.com/generate_204',
        'https://1.1.1.1'
    ];

    for (const endpoint of testEndpoints) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(endpoint, {
                method: 'HEAD',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (res.status >= 200 && res.status < 500) {
                cachedNetStatus = true;
                lastNetCheckTime = now;
                return true;
            }
        } catch (_) {
            // Try next endpoint fallback
        }
    }

    cachedNetStatus = false;
    lastNetCheckTime = now;
    return false;
};

/**
 * Core Helper: Add an event to Sync_Queue
 * Designed to be zero-overhead and non-blocking for local operations.
 */
const queueSyncEvent = async ({ entity_type, entity_id, action_type, payload }) => {
    try {
        const syncId = `SYNC_${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        const jsonPayload = safeJsonStringify(payload || {});

        await db.query(`
            INSERT INTO Sync_Queue (sync_id, entity_type, entity_id, action_type, payload, status)
            VALUES (?, ?, ?, ?, ?, 'PENDING')
        `, [syncId, entity_type, String(entity_id), action_type, jsonPayload]);

        return syncId;
    } catch (err) {
        console.warn('Sync Queue Warning (Non-critical):', err.message);
        return null;
    }
};

exports.queueSyncEvent = queueSyncEvent;

/**
 * Get Live Sync Status for Admin
 * GET /api/sync/status
 */
exports.getSyncStatus = async (req, res) => {
    try {
        // 1. Get settings
        const [settingsRows] = await db.query('SELECT * FROM Sync_Settings WHERE id = 1');
        const settings = settingsRows[0] || {
            cloud_url: 'http://localhost:3001/api/cloud-sync',
            auto_sync_enabled: 1,
            sync_interval_seconds: 15,
            last_successful_sync: null,
            last_ping_status: 'ONLINE'
        };

        // 2. Count queue statistics
        const [counts] = await db.query(`
            SELECT 
                SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pendingCount,
                SUM(CASE WHEN status = 'SYNCED' THEN 1 ELSE 0 END) as syncedCount,
                SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failedCount,
                SUM(CASE WHEN status = 'SYNCING' THEN 1 ELSE 0 END) as syncingCount,
                COUNT(*) as totalQueueCount
            FROM Sync_Queue
        `);

        // 3. Fast connectivity check
        const isOnline = await checkRealInternetConnectivity();
        const currentPingStatus = isOnline ? 'ONLINE' : 'OFFLINE';

        if (settings.last_ping_status !== currentPingStatus) {
            await db.query('UPDATE Sync_Settings SET last_ping_status = ? WHERE id = 1', [currentPingStatus]);
        }

        // 4. Fetch recent 20 queue records for inspection
        const [recentQueue] = await db.query(`
            SELECT id, sync_id, entity_type, entity_id, action_type, status, retry_count, error_message, created_at, synced_at
            FROM Sync_Queue
            ORDER BY created_at DESC
            LIMIT 20
        `);

        res.json({
            status: 'SUCCESS',
            data: {
                isOnline,
                pendingCount: Number(counts[0]?.pendingCount || 0),
                syncedCount: Number(counts[0]?.syncedCount || 0),
                failedCount: Number(counts[0]?.failedCount || 0),
                syncingCount: Number(counts[0]?.syncingCount || 0),
                totalQueueCount: Number(counts[0]?.totalQueueCount || 0),
                lastSuccessfulSync: settings.last_successful_sync,
                settings: {
                    cloud_url: settings.cloud_url,
                    auto_sync_enabled: Boolean(settings.auto_sync_enabled),
                    sync_interval_seconds: settings.sync_interval_seconds,
                    last_ping_status: currentPingStatus
                },
                recentQueue
            }
        });
    } catch (error) {
        console.error('Get Sync Status Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Execute Sync Process (Push pending items to Cloud)
 * POST /api/sync/trigger
 */
exports.triggerSync = async (req, res) => {
    try {
        const [settingsRows] = await db.query('SELECT * FROM Sync_Settings WHERE id = 1');
        const settings = settingsRows[0] || { cloud_url: 'http://localhost:3001/api/cloud-sync' };

        // 1. Fetch pending or failed items (up to 50 items per batch)
        const [items] = await db.query(`
            SELECT * FROM Sync_Queue 
            WHERE status IN ('PENDING', 'FAILED')
            ORDER BY created_at ASC 
            LIMIT 50
        `);

        if (items.length === 0) {
            return res.json({
                status: 'SUCCESS',
                message: 'هیچ تۆمارێکی نوێ نییە بۆ هاوکاتکردن، هەموو داتاکان هاوکات کراون',
                syncedCount: 0
            });
        }

        const syncIds = items.map(i => i.sync_id);
        
        // 2. Mark them as SYNCING
        await db.query(`UPDATE Sync_Queue SET status = 'SYNCING' WHERE sync_id IN (?)`, [syncIds]);

        // 3. Prepare payload for cloud
        const cloudPayload = items.map(item => ({
            sync_id: item.sync_id,
            entity_type: item.entity_type,
            entity_id: item.entity_id,
            action_type: item.action_type,
            payload: typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload,
            created_at: item.created_at
        }));

        let syncSuccess = false;
        let errorMessage = null;

        // If target is local mock cloud or internal API, handle directly or via HTTP
        const targetUrl = settings.cloud_url || 'http://localhost:3001/api/cloud-sync';

        try {
            if (targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1')) {
                // Direct internal cloud database ingestion for maximum reliability
                for (const item of cloudPayload) {
                    await db.query(`
                        INSERT INTO Cloud_Received_Records (sync_id, entity_type, entity_id, action_type, received_payload)
                        VALUES (?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE received_at = CURRENT_TIMESTAMP
                    `, [item.sync_id, item.entity_type, String(item.entity_id), item.action_type, safeJsonStringify(item.payload)]);
                }
                syncSuccess = true;
            } else {
                // Remote HTTP/HTTPS POST to Cloud Endpoint
                const postUrl = new URL(targetUrl.endsWith('/push') ? targetUrl : `${targetUrl.replace(/\/+$/, '')}/push`);
                const isHttps = postUrl.protocol === 'https:';
                const client = isHttps ? https : http;

                const postData = safeJsonStringify({ items: cloudPayload });

                const options = {
                    hostname: postUrl.hostname,
                    port: postUrl.port || (isHttps ? 443 : 80),
                    path: postUrl.pathname + postUrl.search,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData),
                        'x-pos-api-key': settings.api_key || ''
                    },
                    timeout: 5000
                };

                syncSuccess = await new Promise((resolve) => {
                    const postReq = client.request(options, (postRes) => {
                        let resBody = '';
                        postRes.on('data', chunk => resBody += chunk);
                        postRes.on('end', () => {
                            if (postRes.statusCode >= 200 && postRes.statusCode < 300) {
                                resolve(true);
                            } else {
                                errorMessage = `Cloud error HTTP ${postRes.statusCode}: ${resBody.slice(0, 100)}`;
                                resolve(false);
                            }
                        });
                    });

                    postReq.on('error', (e) => {
                        errorMessage = e.message;
                        resolve(false);
                    });

                    postReq.on('timeout', () => {
                        postReq.destroy();
                        errorMessage = 'Cloud connection timed out';
                        resolve(false);
                    });

                    postReq.write(postData);
                    postReq.end();
                });
            }
        } catch (dispatchErr) {
            syncSuccess = false;
            errorMessage = dispatchErr.message;
        }

        // 4. Update Queue Status based on result
        if (syncSuccess) {
            await db.query(`
                UPDATE Sync_Queue 
                SET status = 'SYNCED', synced_at = NOW(), error_message = NULL 
                WHERE sync_id IN (?)
            `, [syncIds]);

            await db.query(`
                UPDATE Sync_Settings 
                SET last_successful_sync = NOW(), last_ping_status = 'ONLINE' 
                WHERE id = 1
            `);

            // Audit log sync
            await logAuditAction({
                req,
                action_type: 'CLOUD_SYNC_COMPLETED',
                entity_name: 'Sync_Queue',
                entity_id: 1,
                details: `هاوکاتکردنی سەرکەوتووی ${items.length} تۆمار لەگەڵ کلاود`
            });

            return res.json({
                status: 'SUCCESS',
                message: `${items.length} تۆمار بە سەرکەوتوویی لەگەڵ کلاود هاوکات کران`,
                syncedCount: items.length
            });
        } else {
            await db.query(`
                UPDATE Sync_Queue 
                SET status = 'FAILED', retry_count = retry_count + 1, error_message = ?
                WHERE sync_id IN (?)
            `, [errorMessage || 'هەڵە لە پەیوەندی بە کلاود', syncIds]);

            await db.query(`
                UPDATE Sync_Settings 
                SET last_ping_status = 'OFFLINE' 
                WHERE id = 1
            `);

            return res.status(502).json({
                status: 'ERROR',
                message: 'هاوکاتکردن سەرکەوتوو نەبوو: ' + (errorMessage || 'پەیوەندی نییە'),
                failedCount: items.length
            });
        }

    } catch (error) {
        console.error('Trigger Sync Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Update Sync & Cloud Settings
 * POST /api/sync/settings
 */
exports.updateSettings = async (req, res) => {
    try {
        const { cloud_url, api_key, auto_sync_enabled, sync_interval_seconds } = req.body;

        await db.query(`
            UPDATE Sync_Settings SET
                cloud_url = COALESCE(?, cloud_url),
                api_key = COALESCE(?, api_key),
                auto_sync_enabled = COALESCE(?, auto_sync_enabled),
                sync_interval_seconds = COALESCE(?, sync_interval_seconds)
            WHERE id = 1
        `, [cloud_url, api_key, auto_sync_enabled !== undefined ? (auto_sync_enabled ? 1 : 0) : null, sync_interval_seconds]);

        res.json({ status: 'SUCCESS', message: 'ڕێکخستنەکانی هاوکاتکردن پاشەکەوت کران' });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Clean up old synced records
 * POST /api/sync/cleanup
 */
exports.cleanupSynced = async (req, res) => {
    try {
        const [result] = await db.query(`
            DELETE FROM Sync_Queue 
            WHERE status = 'SYNCED' AND synced_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
        `);
        res.json({ status: 'SUCCESS', message: `${result.affectedRows} تۆماری کۆن سڕانەوە` });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Cloud-side Endpoints (Gateway / Receiver)
 * Handles incoming push from local POS nodes
 */
exports.cloudHealth = async (req, res) => {
    res.json({
        status: 'ONLINE',
        serverTime: new Date().toISOString(),
        service: 'POS Cloud Gateway',
        version: '2.0.0'
    });
};

exports.cloudPush = async (req, res) => {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
        return res.status(400).json({ status: 'ERROR', message: 'Items array is required' });
    }

    try {
        let insertedCount = 0;
        for (const item of items) {
            await db.query(`
                INSERT INTO Cloud_Received_Records (sync_id, entity_type, entity_id, action_type, received_payload)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE received_at = CURRENT_TIMESTAMP
            `, [item.sync_id, item.entity_type, String(item.entity_id), item.action_type, safeJsonStringify(item.payload)]);
            insertedCount++;
        }

        res.json({
            status: 'SUCCESS',
            message: `${insertedCount} تۆمار بە سەرکەوتوویی لە کلاود وەرگیران`,
            count: insertedCount
        });
    } catch (error) {
        console.error('Cloud Push Receiver Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Background Automatic Sync Runner
 * Runs on a loop every 15-30s if auto_sync_enabled is true
 */
let isSyncInProgress = false;
const runBackgroundAutoSync = async () => {
    if (isSyncInProgress) return;
    try {
        const [settingsRows] = await db.query('SELECT * FROM Sync_Settings WHERE id = 1');
        const settings = settingsRows[0];
        if (!settings || !settings.auto_sync_enabled) return;

        // Check if there are pending items
        const [pendingRows] = await db.query("SELECT COUNT(*) as cnt FROM Sync_Queue WHERE status = 'PENDING'");
        const pendingCount = pendingRows[0]?.cnt || 0;

        if (pendingCount > 0) {
            isSyncInProgress = true;
            // Execute silent mock trigger
            const mockReq = { body: {} };
            const mockRes = {
                status: () => mockRes,
                json: () => mockRes
            };
            await exports.triggerSync(mockReq, mockRes);
        }
    } catch (_) {
    } finally {
        isSyncInProgress = false;
    }
};

// Start background auto-sync scheduler (runs every 15 seconds)
setInterval(runBackgroundAutoSync, 15000);
setTimeout(runBackgroundAutoSync, 3000);
