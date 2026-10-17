const db = require('../db');
const { logAuditAction } = require('../middleware/auditLogger');
const { queueSyncEvent } = require('./sync');

// Reason labels mapping in Kurdish Sorani
const REASON_LABELS = {
    EXPIRED: 'بەسەردەچوون (بەروار بەسەرچوو)',
    BROKEN: 'شکان و لەدەستچوون',
    DAMAGED: 'تێکچوو / کەم و کوڕی',
    THEFT_OR_LOST: 'ونبوون یان دزراو',
    OTHER: 'هۆکاری تر'
};

/**
 * Record a new Wastage / Damage entry.
 * Deducts stock from inventory and calculates financial loss at cost price.
 */
exports.recordDamage = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const {
            product_id,
            unit_type = 'PIECE',
            quantity,
            cost_price,
            reason = 'DAMAGED',
            notes = ''
        } = req.body;

        if (!product_id) {
            return res.status(400).json({ status: 'ERROR', message: 'تکایە کاڵایەک دیاریبکە' });
        }

        const qty = parseFloat(quantity);
        if (!qty || qty <= 0 || isNaN(qty)) {
            return res.status(400).json({ status: 'ERROR', message: 'تکایە ژمارەی دروستی کاڵای زیانلێکەوتوو بنووسە' });
        }

        await connection.beginTransaction();

        // 1. Fetch Product
        const [products] = await connection.query(
            'SELECT id, name, barcode, box_barcode, cost_price, selling_price, stock, units_per_box FROM Products WHERE id = ? FOR UPDATE',
            [product_id]
        );

        if (products.length === 0) {
            await connection.rollback();
            return res.status(404).json({ status: 'ERROR', message: 'کاڵاکە نەدۆزرایەوە' });
        }

        const product = products[0];

        // 2. Determine multiplier and units
        const isBox = unit_type === 'BOX';
        const multiplier = isBox ? Math.max(1, parseFloat(product.units_per_box) || 1) : 1.000;
        const totalUnitsDeducted = qty * multiplier;

        // 3. Determine Cost Price & Total Financial Loss
        const unitCostPrice = (cost_price !== undefined && cost_price !== null && !isNaN(parseFloat(cost_price)) && parseFloat(cost_price) >= 0)
            ? Math.round(parseFloat(cost_price))
            : Math.round(Number(product.cost_price || 0));

        const totalCostLoss = Math.round(totalUnitsDeducted * unitCostPrice);

        // Barcode to store
        const activeBarcode = (isBox && product.box_barcode) ? product.box_barcode : product.barcode;

        // Resolve Reason Label
        const reasonKey = REASON_LABELS[reason] ? reason : 'OTHER';
        const reasonLabel = REASON_LABELS[reasonKey];

        // User info
        const userId = req.user?.id || null;
        const username = req.user?.username || req.headers?.['x-user-name'] || 'کاشێر';

        // 4. Deduct from Inventory Stock
        await connection.query(
            'UPDATE Products SET stock = stock - ? WHERE id = ?',
            [totalUnitsDeducted, product.id]
        );

        // Deduct from Product_Batches FIFO
        let remDamage = Number(totalUnitsDeducted);
        const [damBatches] = await connection.query(`
            SELECT id, remaining_quantity FROM Product_Batches
            WHERE product_id = ? AND status = 'ACTIVE' AND remaining_quantity > 0
            ORDER BY created_at ASC, id ASC
            FOR UPDATE
        `, [product.id]);
        for (const b of damBatches) {
            if (remDamage <= 0) break;
            const ded = Math.min(remDamage, Number(b.remaining_quantity));
            const nRem = Number(b.remaining_quantity) - ded;
            await connection.query('UPDATE Product_Batches SET remaining_quantity = ?, status = ? WHERE id = ?', [
                nRem, nRem <= 0 ? 'EXHAUSTED' : 'ACTIVE', b.id
            ]);
            remDamage -= ded;
        }

        // 5. Insert into Damages table
        const [damageResult] = await connection.query(`
            INSERT INTO Damages (
                product_id,
                barcode,
                product_name,
                unit_type,
                units_multiplier,
                quantity,
                cost_price,
                total_cost_loss,
                reason,
                reason_label,
                notes,
                created_by_user_id,
                created_by_username
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            product.id,
            activeBarcode,
            product.name,
            unit_type,
            multiplier,
            qty,
            unitCostPrice,
            totalCostLoss,
            reasonKey,
            reasonLabel,
            notes ? notes.trim() : null,
            userId,
            username
        ]);

        await connection.commit();

        // Queue Damage entry for Offline & Online Sync
        await queueSyncEvent({
            entity_type: 'DAMAGE',
            entity_id: damageResult.insertId,
            action_type: 'CREATE',
            payload: {
                damage_id: damageResult.insertId,
                product_id: product.id,
                product_name: product.name,
                barcode: activeBarcode,
                unit_type,
                units_multiplier: multiplier,
                quantity: qty,
                cost_price: unitCostPrice,
                total_cost_loss: totalCostLoss,
                reason: reasonKey,
                reason_label: reasonLabel,
                timestamp: new Date().toISOString()
            }
        });

        // 6. Audit Log
        const unitText = isBox ? `کارتۆن (${multiplier} دانەیی)` : 'دانە';
        await logAuditAction({
            req,
            action_type: 'STOCK_ADJUSTMENT',
            entity_name: 'Damages',
            entity_id: damageResult.insertId,
            new_value: {
                damage_id: damageResult.insertId,
                product_name: product.name,
                quantity: qty,
                unit_type,
                total_units_deducted: totalUnitsDeducted,
                cost_price: unitCostPrice,
                total_cost_loss: totalCostLoss,
                reason: reasonLabel
            },
            details: `تۆمارکردنی زیانی کاڵا: "${product.name}" بە بڕی ${qty} ${unitText} بە هۆکاری (${reasonLabel})، زەرەری دارایی: ${totalCostLoss.toLocaleString()} د.ع`
        });

        res.status(201).json({
            status: 'SUCCESS',
            message: `زیانی کاڵا بە سەرکەوتوویی تۆمارکرا. بڕی ${totalUnitsDeducted} دانە لە مەخزەن دەرچوو و بڕی ${totalCostLoss.toLocaleString()} د.ع وەک زەرەر دیاریکرا.`,
            data: {
                damage_id: damageResult.insertId,
                product_name: product.name,
                quantity: qty,
                unit_type,
                total_units_deducted: totalUnitsDeducted,
                new_stock: Number(product.stock) - totalUnitsDeducted,
                cost_price: unitCostPrice,
                total_cost_loss: totalCostLoss,
                reason: reasonLabel
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error in recordDamage:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    } finally {
        connection.release();
    }
};

/**
 * Fetch Damages History with filters
 */
exports.getDamagesHistory = async (req, res) => {
    try {
        const { filter = 'ALL', reason, search, from, to } = req.query;

        let query = `
            SELECT 
                d.*,
                p.stock as current_stock,
                p.selling_price
            FROM Damages d
            LEFT JOIN Products p ON d.product_id = p.id
            WHERE 1=1
        `;
        const params = [];

        if (filter === 'TODAY') {
            query += ` AND DATE(d.created_at) = CURRENT_DATE()`;
        } else if (filter === 'THIS_MONTH') {
            query += ` AND MONTH(d.created_at) = MONTH(CURRENT_DATE()) AND YEAR(d.created_at) = YEAR(CURRENT_DATE())`;
        } else if (from && to) {
            query += ` AND DATE(d.created_at) BETWEEN ? AND ?`;
            params.push(from, to);
        }

        if (reason && reason !== 'ALL') {
            query += ` AND d.reason = ?`;
            params.push(reason);
        }

        if (search && search.trim() !== '') {
            query += ` AND (d.product_name LIKE ? OR d.barcode LIKE ? OR d.notes LIKE ?)`;
            const s = `%${search.trim()}%`;
            params.push(s, s, s);
        }

        query += ` ORDER BY d.id DESC LIMIT 300`;

        const [rows] = await db.query(query, params);

        res.json({
            status: 'SUCCESS',
            data: rows
        });
    } catch (error) {
        console.error('Error in getDamagesHistory:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Fetch Summary Stats for Damages
 */
exports.getDamagesStats = async (req, res) => {
    try {
        // 1. This Month Totals
        const [thisMonthRows] = await db.query(`
            SELECT 
                COALESCE(SUM(total_cost_loss), 0) as this_month_loss,
                COALESCE(SUM(quantity * units_multiplier), 0) as this_month_units,
                COUNT(id) as this_month_records
            FROM Damages
            WHERE MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())
        `);

        // 2. Today Totals
        const [todayRows] = await db.query(`
            SELECT 
                COALESCE(SUM(total_cost_loss), 0) as today_loss,
                COALESCE(SUM(quantity * units_multiplier), 0) as today_units,
                COUNT(id) as today_records
            FROM Damages
            WHERE DATE(created_at) = CURRENT_DATE()
        `);

        // 3. Lifetime Totals
        const [lifetimeRows] = await db.query(`
            SELECT 
                COALESCE(SUM(total_cost_loss), 0) as lifetime_loss,
                COALESCE(SUM(quantity * units_multiplier), 0) as lifetime_units,
                COUNT(id) as lifetime_records
            FROM Damages
        `);

        // 4. Breakdown by Reason
        const [reasonBreakdown] = await db.query(`
            SELECT 
                reason,
                reason_label,
                COUNT(id) as record_count,
                COALESCE(SUM(total_cost_loss), 0) as total_loss,
                COALESCE(SUM(quantity * units_multiplier), 0) as total_units
            FROM Damages
            GROUP BY reason, reason_label
            ORDER BY total_loss DESC
        `);

        // 5. Top 5 Most Damaged Products
        const [topProducts] = await db.query(`
            SELECT 
                product_id,
                product_name,
                COUNT(id) as damage_occurrences,
                COALESCE(SUM(quantity * units_multiplier), 0) as total_units_lost,
                COALESCE(SUM(total_cost_loss), 0) as total_cost_loss
            FROM Damages
            GROUP BY product_id, product_name
            ORDER BY total_cost_loss DESC
            LIMIT 5
        `);

        res.json({
            status: 'SUCCESS',
            data: {
                this_month: thisMonthRows[0],
                today: todayRows[0],
                lifetime: lifetimeRows[0],
                reason_breakdown: reasonBreakdown,
                top_products: topProducts
            }
        });
    } catch (error) {
        console.error('Error in getDamagesStats:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Delete / Revert a damage record (Admin Only)
 * Reverses the inventory stock deduction and deletes the damage record.
 */
exports.deleteDamageRecord = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { id } = req.params;

        await connection.beginTransaction();

        const [records] = await connection.query('SELECT * FROM Damages WHERE id = ? FOR UPDATE', [id]);
        if (records.length === 0) {
            await connection.rollback();
            return res.status(404).json({ status: 'ERROR', message: 'تۆماری زیانەکە نەدۆزرایەوە' });
        }

        const record = records[0];
        const unitsToRestore = parseFloat(record.quantity) * parseFloat(record.units_multiplier);

        // 1. Restore Inventory Stock
        await connection.query(
            'UPDATE Products SET stock = stock + ? WHERE id = ?',
            [unitsToRestore, record.product_id]
        );

        // 2. Delete Damage Record
        await connection.query('DELETE FROM Damages WHERE id = ?', [id]);

        await connection.commit();

        // 3. Audit Log
        await logAuditAction({
            req,
            action_type: 'STOCK_ADJUSTMENT',
            entity_name: 'Damages',
            entity_id: id,
            old_value: record,
            details: `سڕینەوەی تۆماری زیان: گەڕاندنەوەی ${unitsToRestore} دانەی کاڵای "${record.product_name}" بۆ کۆگا`
        });

        res.json({
            status: 'SUCCESS',
            message: `تۆماری زیانەکە سڕدرایەوە و ${unitsToRestore} دانە گەڕێنرایەوە بۆ کۆگا.`
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error in deleteDamageRecord:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    } finally {
        connection.release();
    }
};
