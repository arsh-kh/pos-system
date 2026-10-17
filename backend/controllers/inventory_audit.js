const db = require('../db');
const { logAuditAction } = require('../middleware/auditLogger');

/**
 * Reconcile Product Stock during Smart Inventory Audit.
 * Accurately updates product stock, and if shortage is detected,
 * records damage under 'THEFT_OR_LOST' to deduct from net profit.
 */
exports.reconcileProductStock = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const {
            product_id,
            counted_stock,
            unit_type = 'PIECE',
            notes = ''
        } = req.body;

        if (!product_id) {
            return res.status(400).json({ status: 'ERROR', message: 'تکایە کاڵایەک دەستنیشان بکە یان بارکۆدەکەی سکان بکە' });
        }

        const countNum = parseFloat(counted_stock);
        if (isNaN(countNum) || countNum < 0) {
            return res.status(400).json({ status: 'ERROR', message: 'تکایە ژمارەی دروستی ژماردنی ڕاستەقینە داخڵ بکە (نابێت نێگەتیڤ بێت)' });
        }

        await connection.beginTransaction();

        // 1. Fetch Product FOR UPDATE
        const [products] = await connection.query(
            'SELECT id, name, barcode, box_barcode, cost_price, selling_price, stock, units_per_box FROM Products WHERE id = ? FOR UPDATE',
            [product_id]
        );

        if (products.length === 0) {
            await connection.rollback();
            return res.status(404).json({ status: 'ERROR', message: 'کاڵاکە نەدۆزرایەوە' });
        }

        const product = products[0];
        const isBox = unit_type === 'BOX';
        const multiplier = isBox ? Math.max(1, parseFloat(product.units_per_box) || 1) : 1.000;
        
        // Convert counted quantity into single inventory units
        const countedUnits = countNum * multiplier;
        const systemUnits = parseFloat(product.stock) || 0;
        const differenceUnits = countedUnits - systemUnits;
        const unitCost = Math.round(Number(product.cost_price || 0));
        const totalDiscrepancyValue = Math.round(differenceUnits * unitCost);

        // Determine Status
        let status = 'MATCH';
        if (differenceUnits < -0.0001) {
            status = 'SHORTAGE'; // نوقسانی و کەمبوون
        } else if (differenceUnits > 0.0001) {
            status = 'SURPLUS'; // زیادە
        }

        // Active Barcode
        const activeBarcode = (isBox && product.box_barcode) ? product.box_barcode : product.barcode;
        const username = req.user?.username || req.headers?.['x-user-name'] || 'کاشێر';
        const userId = req.user?.id || null;

        // 2. Update Product Stock to the counted units
        await connection.query(
            'UPDATE Products SET stock = ? WHERE id = ?',
            [countedUnits, product.id]
        );

        let damageId = null;

        // 3. If SHORTAGE (نوقسانی): Record in Damages table to reflect in True Net Profit
        if (status === 'SHORTAGE') {
            const shortageQty = Math.abs(differenceUnits);
            const shortageCostLoss = Math.abs(totalDiscrepancyValue);

            const damageNote = notes && notes.trim() !== ''
                ? `جەردی کۆگا: ${notes.trim()} (سیستەم: ${systemUnits}، ژماردن: ${countedUnits})`
                : `نوقسانی لە کاتی جەردکردندا دۆزرایەوە: ژمارەی سیستەم ${systemUnits} دانە بوو، لە جەرددا ${countedUnits} دانە دۆزرایەوە (${shortageQty} دانە کەمبووە)`;

            const [damageRes] = await connection.query(`
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
                'PIECE',
                1.000,
                shortageQty,
                unitCost,
                shortageCostLoss,
                'THEFT_OR_LOST',
                'نوقسانی لە کاتی جەردکردن (ونبوون یان دزراو)',
                damageNote,
                userId,
                username
            ]);

            damageId = damageRes.insertId;
        }

        // 4. Record into Inventory_Audits table
        const [auditRes] = await connection.query(`
            INSERT INTO Inventory_Audits (
                product_id,
                product_name,
                barcode,
                unit_type,
                units_multiplier,
                system_stock,
                counted_stock,
                difference_qty,
                cost_price,
                total_cost_discrepancy,
                status,
                damage_id,
                audited_by_username,
                notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            product.id,
            product.name,
            activeBarcode,
            unit_type,
            multiplier,
            systemUnits,
            countedUnits,
            differenceUnits,
            unitCost,
            totalDiscrepancyValue,
            status,
            damageId,
            username,
            notes ? notes.trim() : null
        ]);

        await connection.commit();

        // 5. Audit Log
        let auditDetails = `جەردکردنی کاڵای "${product.name}": ژمارەی پێشوو: ${systemUnits} دانە، ژمارەی جەردکراو: ${countedUnits} دانە. `;
        if (status === 'SHORTAGE') {
            auditDetails += `⚠️ نوقسانی: ${Math.abs(differenceUnits)} دانە بە زەرەری دارایی ${Math.abs(totalDiscrepancyValue).toLocaleString()} د.ع کە خرایە سەر زیانەکان.`;
        } else if (status === 'SURPLUS') {
            auditDetails += `📈 زیادە: +${differenceUnits} دانە بە بەهای ${totalDiscrepancyValue.toLocaleString()} د.ع.`;
        } else {
            auditDetails += `✅ هاوتا و تەواو بوو بێ هیچ کەم و کوڕییەک.`;
        }

        await logAuditAction({
            req,
            action_type: 'STOCK_ADJUSTMENT',
            entity_name: 'Inventory_Audits',
            entity_id: auditRes.insertId,
            new_value: {
                audit_id: auditRes.insertId,
                product_name: product.name,
                system_stock: systemUnits,
                counted_stock: countedUnits,
                difference_qty: differenceUnits,
                status,
                damage_id: damageId
            },
            details: auditDetails
        });

        res.status(200).json({
            status: 'SUCCESS',
            message: status === 'SHORTAGE'
                ? `جەرد بە سەرکەوتوویی پەسەندکرا: بڕی ${Math.abs(differenceUnits)} دانە نوقسانی دۆزرایەوە، مەخزەن ڕێکخرایەوە بۆ ${countedUnits} دانە و بڕی ${Math.abs(totalDiscrepancyValue).toLocaleString()} دینار خرایە سەر لیستی زیانەکانی ئەم مانگە.`
                : (status === 'SURPLUS'
                    ? `جەرد پەسەندکرا: ${differenceUnits} دانە زیادە دۆزرایەوە و مەخزەن زیادکرا بۆ ${countedUnits} دانە.`
                    : `جەرد پەسەندکرا: ژمارەی ناو مەخزەن (${countedUnits} دانە) ڕێک هاوتای سیستەم بوو بێ هیچ جیاوازییەک.`),
            data: {
                audit_id: auditRes.insertId,
                product_id: product.id,
                product_name: product.name,
                barcode: activeBarcode,
                unit_type,
                units_multiplier: multiplier,
                system_stock: systemUnits,
                counted_stock: countedUnits,
                difference_qty: differenceUnits,
                cost_price: unitCost,
                total_cost_discrepancy: totalDiscrepancyValue,
                status,
                damage_id: damageId,
                audited_by_username: username,
                created_at: new Date().toISOString()
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error in reconcileProductStock:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    } finally {
        connection.release();
    }
};

/**
 * Get Audit History with filters
 */
exports.getAuditHistory = async (req, res) => {
    try {
        const { filter = 'ALL', status = 'ALL', search } = req.query;

        let query = `
            SELECT ia.*, p.stock as current_stock, p.cost_price as current_cost
            FROM Inventory_Audits ia
            LEFT JOIN Products p ON ia.product_id = p.id
            WHERE 1=1
        `;
        const params = [];

        if (filter === 'TODAY') {
            query += ' AND DATE(ia.created_at) = CURRENT_DATE()';
        } else if (filter === 'THIS_MONTH') {
            query += ' AND MONTH(ia.created_at) = MONTH(CURRENT_DATE()) AND YEAR(ia.created_at) = YEAR(CURRENT_DATE())';
        }

        if (status && status !== 'ALL') {
            query += ' AND ia.status = ?';
            params.push(status);
        }

        if (search && search.trim() !== '') {
            query += ' AND (ia.product_name LIKE ? OR ia.barcode LIKE ? OR ia.notes LIKE ? OR ia.audited_by_username LIKE ?)';
            const s = `%${search.trim()}%`;
            params.push(s, s, s, s);
        }

        query += ' ORDER BY ia.id DESC LIMIT 300';

        const [rows] = await db.query(query, params);
        res.json({ status: 'SUCCESS', data: rows });
    } catch (error) {
        console.error('Error in getAuditHistory:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Get Audit KPI Summary Statistics
 */
exports.getAuditStats = async (req, res) => {
    try {
        // 1. This Month Totals
        const [monthStats] = await db.query(`
            SELECT 
                COUNT(id) as total_audits,
                SUM(CASE WHEN status = 'MATCH' THEN 1 ELSE 0 END) as matches_count,
                SUM(CASE WHEN status = 'SHORTAGE' THEN 1 ELSE 0 END) as shortages_count,
                SUM(CASE WHEN status = 'SURPLUS' THEN 1 ELSE 0 END) as surpluses_count,
                COALESCE(SUM(CASE WHEN status = 'SHORTAGE' THEN ABS(total_cost_discrepancy) ELSE 0 END), 0) as total_shortage_loss,
                COALESCE(SUM(CASE WHEN status = 'SURPLUS' THEN total_cost_discrepancy ELSE 0 END), 0) as total_surplus_value
            FROM Inventory_Audits
            WHERE MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())
        `);

        // 2. Today Totals
        const [todayStats] = await db.query(`
            SELECT 
                COUNT(id) as total_audits,
                SUM(CASE WHEN status = 'MATCH' THEN 1 ELSE 0 END) as matches_count,
                SUM(CASE WHEN status = 'SHORTAGE' THEN 1 ELSE 0 END) as shortages_count,
                COALESCE(SUM(CASE WHEN status = 'SHORTAGE' THEN ABS(total_cost_discrepancy) ELSE 0 END), 0) as today_shortage_loss
            FROM Inventory_Audits
            WHERE DATE(created_at) = CURRENT_DATE()
        `);

        // 3. Lifetime Totals
        const [lifetimeStats] = await db.query(`
            SELECT 
                COUNT(id) as total_audits,
                COALESCE(SUM(CASE WHEN status = 'SHORTAGE' THEN ABS(total_cost_discrepancy) ELSE 0 END), 0) as lifetime_shortage_loss
            FROM Inventory_Audits
        `);

        res.json({
            status: 'SUCCESS',
            data: {
                this_month: monthStats[0],
                today: todayStats[0],
                lifetime: lifetimeStats[0]
            }
        });
    } catch (error) {
        console.error('Error in getAuditStats:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Revert an Audit Entry (Admin Only)
 * Restores product stock to previous system_stock and removes associated damage record if any.
 */
exports.revertAudit = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { id } = req.params;

        await connection.beginTransaction();

        const [records] = await connection.query('SELECT * FROM Inventory_Audits WHERE id = ? FOR UPDATE', [id]);
        if (records.length === 0) {
            await connection.rollback();
            return res.status(404).json({ status: 'ERROR', message: 'تۆماری جەرد نەدۆزرایەوە' });
        }

        const audit = records[0];

        // 1. Revert product stock to system_stock
        await connection.query(
            'UPDATE Products SET stock = ? WHERE id = ?',
            [audit.system_stock, audit.product_id]
        );

        // 2. If it created a damage record, remove it
        if (audit.damage_id) {
            await connection.query('DELETE FROM Damages WHERE id = ?', [audit.damage_id]);
        }

        // 3. Delete Audit record
        await connection.query('DELETE FROM Inventory_Audits WHERE id = ?', [id]);

        await connection.commit();

        // 4. Audit Log
        await logAuditAction({
            req,
            action_type: 'STOCK_ADJUSTMENT',
            entity_name: 'Inventory_Audits',
            entity_id: id,
            old_value: audit,
            details: `هەڵوەشاندنەوەی جەرد بۆ کاڵای "${audit.product_name}": مەخزەن گەڕایەوە بۆ بڕی پێشووی (${audit.system_stock} دانە)`
        });

        res.json({
            status: 'SUCCESS',
            message: `جەردەکە هەڵوەشێندرایەوە و مەخزەن گەڕایەوە بۆ ${audit.system_stock} دانە.`
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error in revertAudit:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    } finally {
        connection.release();
    }
};
