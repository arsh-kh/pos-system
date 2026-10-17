const db = require('../db');
const { logAuditAction } = require('../middleware/auditLogger');

const safeBigInt = (val) => {
    const num = Math.round(Number(val) || 0);
    return BigInt(num);
};

/**
 * Create a new Purchase Return (Return to Vendor - RTV).
 * Deducts stock from inventory (with carton multiplier support)
 * and deducts the amount from the supplier's debt (or cash refund).
 */
exports.createPurchaseReturn = async (req, res) => {
    const { 
        supplier_id, 
        product_id, 
        unit_type = 'PIECE',
        quantity, 
        cost_price, 
        refund_type = 'DEBT_DEDUCT', 
        reason = 'بەسەردەچوونی بەروار',
        representative_name = '',
        notes = ''
    } = req.body;

    const returnQty = Math.max(0.001, parseFloat(quantity) || 0);
    const returnCost = Math.max(0, Math.round(Number(cost_price) || 0));

    if (!product_id || returnQty <= 0 || returnCost <= 0) {
        return res.status(400).json({ status: 'ERROR', message: 'تکایە کاڵا، بڕ و نرخی گەڕاندنەوە دیاری بکە' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Fetch & Verify Product
        const [prodRows] = await connection.query(
            'SELECT id, name, barcode, box_barcode, stock, units_per_box, cost_price FROM Products WHERE id = ? FOR UPDATE', 
            [product_id]
        );
        if (prodRows.length === 0) {
            throw new Error('کاڵاکە نەدۆزرایەوە');
        }

        const product = prodRows[0];
        const isBox = unit_type === 'BOX';
        const multiplier = isBox ? Math.max(1, parseFloat(product.units_per_box) || 1) : 1.000;
        const totalUnitsDeducted = returnQty * multiplier;
        const totalRefund = Math.round(returnCost * totalUnitsDeducted);

        // 2. Fetch & Verify Supplier (if provided)
        let supplierName = 'کڕینی لۆکاڵی / بێ کۆمپانیا';
        let supplierPhone = null;
        let prevRemainingDebt = 0;
        let newRemainingDebt = 0;

        if (supplier_id) {
            const [supRows] = await connection.query(
                'SELECT id, name, phone, total_remaining FROM Suppliers WHERE id = ? FOR UPDATE',
                [supplier_id]
            );
            if (supRows.length > 0) {
                supplierName = supRows[0].name;
                supplierPhone = supRows[0].phone;
                prevRemainingDebt = Number(supRows[0].total_remaining) || 0;
            }
        }

        // 3. Deduct stock from Products
        await connection.query(
            'UPDATE Products SET stock = stock - ? WHERE id = ?', 
            [totalUnitsDeducted, product_id]
        );

        // Deduct from Product_Batches FIFO
        let remRtv = Number(totalUnitsDeducted);
        const [rtvBatches] = await connection.query(`
            SELECT id, remaining_quantity FROM Product_Batches
            WHERE product_id = ? AND status = 'ACTIVE' AND remaining_quantity > 0
            ORDER BY created_at ASC, id ASC
            FOR UPDATE
        `, [product_id]);
        for (const b of rtvBatches) {
            if (remRtv <= 0) break;
            const ded = Math.min(remRtv, Number(b.remaining_quantity));
            const nRem = Number(b.remaining_quantity) - ded;
            await connection.query('UPDATE Product_Batches SET remaining_quantity = ?, status = ? WHERE id = ?', [
                nRem, nRem <= 0 ? 'EXHAUSTED' : 'ACTIVE', b.id
            ]);
            remRtv -= ded;
        }

        // 4. If DEBT_DEDUCT and supplier_id is present, deduct from supplier remaining debt
        if (supplier_id && refund_type === 'DEBT_DEDUCT') {
            await connection.query(
                'UPDATE Suppliers SET total_remaining = GREATEST(0, total_remaining - ?) WHERE id = ?',
                [safeBigInt(totalRefund).toString(), supplier_id]
            );
            newRemainingDebt = Math.max(0, prevRemainingDebt - totalRefund);
        } else {
            newRemainingDebt = prevRemainingDebt;
        }

        // Username
        const username = req.user?.username || req.headers?.['x-user-name'] || 'کاشێر';

        // 5. Insert into Purchase_Returns
        const [result] = await connection.query(`
            INSERT INTO Purchase_Returns (
                supplier_id, 
                product_id, 
                unit_type,
                units_multiplier,
                quantity, 
                cost_price, 
                total_refund, 
                refund_type, 
                reason,
                representative_name,
                created_by_username,
                notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            supplier_id || null, 
            product_id, 
            unit_type,
            multiplier,
            returnQty, 
            returnCost, 
            totalRefund, 
            refund_type, 
            reason || null,
            representative_name ? representative_name.trim() : null,
            username,
            notes ? notes.trim() : null
        ]);

        await connection.commit();

        // 6. Audit Log
        const unitLabel = isBox ? `کارتۆن (${multiplier} دانەیی)` : 'دانە';
        await logAuditAction({
            req,
            action_type: 'STOCK_ADJUSTMENT',
            entity_name: 'Purchase_Returns',
            entity_id: result.insertId,
            new_value: {
                return_id: result.insertId,
                product_name: product.name,
                supplier_name: supplierName,
                representative_name: representative_name || null,
                quantity: returnQty,
                unit_type,
                total_units_deducted: totalUnitsDeducted,
                cost_price: returnCost,
                total_refund: totalRefund,
                refund_type,
                prev_supplier_debt: prevRemainingDebt,
                new_supplier_debt: newRemainingDebt
            },
            details: `گەڕاندنەوە بۆ کۆمپانیای "${supplierName}" (مەندوب: ${representative_name || 'دیارینەکراو'}): بڕی ${returnQty} ${unitLabel}ـی "${product.name}"، داشکاندن لە قەرز: ${totalRefund.toLocaleString()} د.ع`
        });

        res.status(201).json({ 
            status: 'SUCCESS', 
            message: `کاڵاکە بە سەرکەوتوویی درایەوە بە مەندوب. بڕی ${totalUnitsDeducted} دانە لە مەخزەن دەرکرا و ${totalRefund.toLocaleString()} د.ع لە قەرزی کۆمپانیا کەمدەبێتەوە.`,
            returnId: result.insertId,
            data: {
                return_id: result.insertId,
                supplier_id,
                supplier_name: supplierName,
                supplier_phone: supplierPhone,
                representative_name,
                product_id,
                product_name: product.name,
                barcode: (isBox && product.box_barcode) ? product.box_barcode : product.barcode,
                quantity: returnQty,
                unit_type,
                units_multiplier: multiplier,
                total_units_deducted: totalUnitsDeducted,
                cost_price: returnCost,
                total_refund: totalRefund,
                refund_type,
                reason,
                prev_supplier_debt: prevRemainingDebt,
                new_supplier_debt: newRemainingDebt,
                created_by_username: username,
                created_at: new Date().toISOString()
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Purchase Return Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    } finally {
        connection.release();
    }
};

/**
 * Get all Purchase Returns with rich details and filters
 */
exports.getAllPurchaseReturns = async (req, res) => {
    try {
        const { supplier_id, filter = 'ALL', search } = req.query;

        let query = `
            SELECT pr.*, 
                   COALESCE(s.name, 'کڕینی لۆکاڵی / بێ کۆمپانیا') as supplier_name,
                   s.phone as supplier_phone,
                   s.total_remaining as supplier_current_debt,
                   p.name as product_name,
                   p.barcode as product_barcode,
                   p.box_barcode as product_box_barcode,
                   p.stock as current_stock
            FROM Purchase_Returns pr
            LEFT JOIN Suppliers s ON pr.supplier_id = s.id
            JOIN Products p ON pr.product_id = p.id
            WHERE 1=1
        `;
        const params = [];

        if (supplier_id && supplier_id !== 'ALL') {
            query += ' AND pr.supplier_id = ?';
            params.push(supplier_id);
        }

        if (filter === 'TODAY') {
            query += ' AND DATE(pr.created_at) = CURRENT_DATE()';
        } else if (filter === 'THIS_MONTH') {
            query += ' AND MONTH(pr.created_at) = MONTH(CURRENT_DATE()) AND YEAR(pr.created_at) = YEAR(CURRENT_DATE())';
        }

        if (search && search.trim() !== '') {
            query += ' AND (p.name LIKE ? OR p.barcode LIKE ? OR pr.representative_name LIKE ? OR s.name LIKE ? OR pr.notes LIKE ?)';
            const s = `%${search.trim()}%`;
            params.push(s, s, s, s, s);
        }

        query += ' ORDER BY pr.id DESC LIMIT 300';

        const [rows] = await db.query(query, params);
        res.json({ status: 'SUCCESS', data: rows });
    } catch (error) {
        console.error('Error in getAllPurchaseReturns:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Get RTV Summary Statistics
 */
exports.getPurchaseReturnsStats = async (req, res) => {
    try {
        // 1. This Month Totals
        const [thisMonthRows] = await db.query(`
            SELECT 
                COALESCE(SUM(total_refund), 0) as this_month_refund,
                COALESCE(SUM(quantity * units_multiplier), 0) as this_month_units,
                COUNT(id) as this_month_records
            FROM Purchase_Returns
            WHERE MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())
        `);

        // 2. Today Totals
        const [todayRows] = await db.query(`
            SELECT 
                COALESCE(SUM(total_refund), 0) as today_refund,
                COALESCE(SUM(quantity * units_multiplier), 0) as today_units,
                COUNT(id) as today_records
            FROM Purchase_Returns
            WHERE DATE(created_at) = CURRENT_DATE()
        `);

        // 3. Lifetime Totals
        const [lifetimeRows] = await db.query(`
            SELECT 
                COALESCE(SUM(total_refund), 0) as lifetime_refund,
                COALESCE(SUM(quantity * units_multiplier), 0) as lifetime_units,
                COUNT(id) as lifetime_records
            FROM Purchase_Returns
        `);

        // 4. Debt Deducted vs Cash Refunded
        const [settlementStats] = await db.query(`
            SELECT 
                refund_type,
                COALESCE(SUM(total_refund), 0) as total_amount,
                COUNT(id) as total_count
            FROM Purchase_Returns
            GROUP BY refund_type
        `);

        // 5. Top Suppliers Returned to
        const [topSuppliers] = await db.query(`
            SELECT 
                pr.supplier_id,
                COALESCE(s.name, 'کڕینی لۆکاڵی') as supplier_name,
                COUNT(pr.id) as return_count,
                COALESCE(SUM(pr.total_refund), 0) as total_amount_refunded
            FROM Purchase_Returns pr
            LEFT JOIN Suppliers s ON pr.supplier_id = s.id
            GROUP BY pr.supplier_id, s.name
            ORDER BY total_amount_refunded DESC
            LIMIT 5
        `);

        res.json({
            status: 'SUCCESS',
            data: {
                this_month: thisMonthRows[0],
                today: todayRows[0],
                lifetime: lifetimeRows[0],
                settlement: settlementStats,
                top_suppliers: topSuppliers
            }
        });
    } catch (error) {
        console.error('Error in getPurchaseReturnsStats:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

/**
 * Revert / Delete a Purchase Return (Admin only)
 * Reverses the stock deduction and restores the supplier debt.
 */
exports.deletePurchaseReturn = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { id } = req.params;

        await connection.beginTransaction();

        const [records] = await connection.query('SELECT * FROM Purchase_Returns WHERE id = ? FOR UPDATE', [id]);
        if (records.length === 0) {
            await connection.rollback();
            return res.status(404).json({ status: 'ERROR', message: 'تۆماری گەڕاندنەوە نەدۆزرایەوە' });
        }

        const record = records[0];
        const unitsToRestore = parseFloat(record.quantity) * parseFloat(record.units_multiplier);

        // 1. Restore Inventory Stock
        await connection.query(
            'UPDATE Products SET stock = stock + ? WHERE id = ?',
            [unitsToRestore, record.product_id]
        );

        // 2. Restore Supplier Debt if it was deducted
        if (record.supplier_id && record.refund_type === 'DEBT_DEDUCT') {
            await connection.query(
                'UPDATE Suppliers SET total_remaining = total_remaining + ? WHERE id = ?',
                [record.total_refund, record.supplier_id]
            );
        }

        // 3. Delete Record
        await connection.query('DELETE FROM Purchase_Returns WHERE id = ?', [id]);

        await connection.commit();

        // 4. Audit Log
        await logAuditAction({
            req,
            action_type: 'STOCK_ADJUSTMENT',
            entity_name: 'Purchase_Returns',
            entity_id: id,
            old_value: record,
            details: `هەڵوەشاندنەوەی گەڕاندنەوە بۆ کۆمپانیا: گەڕاندنەوەی ${unitsToRestore} دانە بۆ مەخزەن و زیادکردنەوەی ${Number(record.total_refund).toLocaleString()} د.ع بۆ سەر قەرزی کۆمپانیا`
        });

        res.json({
            status: 'SUCCESS',
            message: `تۆماری گەڕاندنەوە هەڵوەشێندرایەوە. بڕی ${unitsToRestore} دانە خرایەوە سەر کۆگا و ${Number(record.total_refund).toLocaleString()} د.ع گەڕایەوە سەر باڵانسی قەرزی کۆمپانیا.`
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error in deletePurchaseReturn:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    } finally {
        connection.release();
    }
};
