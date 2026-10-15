const db = require('../db');

// Get all promotions with product details and computed status
exports.getAllPromotions = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.*,
                   pr.name as product_name,
                   pr.barcode,
                   pr.selling_price as original_price,
                   pr.cost_price,
                   pr.stock,
                   pr.unit,
                   CASE 
                       WHEN p.is_active = FALSE THEN 'INACTIVE'
                       WHEN CURDATE() < p.start_date THEN 'SCHEDULED'
                       WHEN CURDATE() > p.end_date THEN 'EXPIRED'
                       ELSE 'ACTIVE'
                   END as calculated_status
            FROM Promotions p
            JOIN Products pr ON p.product_id = pr.id
            ORDER BY p.is_active DESC, p.id DESC
        `);

        res.json({ status: 'SUCCESS', data: rows });
    } catch (error) {
        console.error('Get All Promotions Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

// Get currently active promotions for POS cashier
exports.getActivePromotions = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.*,
                   pr.name as product_name,
                   pr.barcode,
                   pr.selling_price as original_price,
                   pr.cost_price,
                   pr.unit
            FROM Promotions p
            JOIN Products pr ON p.product_id = pr.id
            WHERE p.is_active = TRUE 
              AND CURDATE() BETWEEN p.start_date AND p.end_date
            ORDER BY p.id DESC
        `);

        // Compute effective promo price for each item
        const activeMap = {};
        rows.forEach(promo => {
            const orig = Number(promo.original_price);
            let promoPrice = orig;
            if (promo.discount_type === 'PERCENT') {
                promoPrice = Math.max(0, Math.round(orig - (orig * Number(promo.discount_value)) / 100));
            } else {
                promoPrice = Math.max(0, Math.round(Number(promo.discount_value)));
            }

            activeMap[promo.product_id] = {
                ...promo,
                promo_price: promoPrice,
                savings_per_unit: Math.max(0, orig - promoPrice)
            };
        });

        res.json({ status: 'SUCCESS', data: rows, activeMap });
    } catch (error) {
        console.error('Get Active Promotions Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

// Create a new promotion
exports.createPromotion = async (req, res) => {
    const { 
        product_id, 
        discount_type, 
        discount_value, 
        max_qty_per_sale, 
        start_date, 
        end_date, 
        notes 
    } = req.body;

    try {
        if (!product_id || !discount_value || !start_date || !end_date) {
            return res.status(400).json({ status: 'ERROR', message: 'تکایە هەموو زانیارییە سەرەکییەکان پڕبکەرەوە' });
        }

        if (new Date(start_date) > new Date(end_date)) {
            return res.status(400).json({ status: 'ERROR', message: 'بەرواری دەستپێک نابێت لە بەرواری کۆتایی درەنگتر بێت' });
        }

        const discType = discount_type === 'PERCENT' ? 'PERCENT' : 'FIXED_PRICE';
        const discVal = Math.max(0, parseFloat(discount_value) || 0);
        const maxQty = max_qty_per_sale ? Math.max(0.001, parseFloat(max_qty_per_sale)) : null;

        const [result] = await db.query(`
            INSERT INTO Promotions 
                (product_id, discount_type, discount_value, max_qty_per_sale, start_date, end_date, is_active, notes)
            VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)
        `, [product_id, discType, discVal, maxQty, start_date, end_date, notes || null]);

        res.status(201).json({
            status: 'SUCCESS',
            message: 'ئۆفەری نوێ بە سەرکەوتوویی تۆمارکرا',
            data: { id: result.insertId }
        });
    } catch (error) {
        console.error('Create Promotion Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

// Update an existing promotion
exports.updatePromotion = async (req, res) => {
    const { id } = req.params;
    const { 
        discount_type, 
        discount_value, 
        max_qty_per_sale, 
        start_date, 
        end_date, 
        notes 
    } = req.body;

    try {
        const discType = discount_type === 'PERCENT' ? 'PERCENT' : 'FIXED_PRICE';
        const discVal = Math.max(0, parseFloat(discount_value) || 0);
        const maxQty = max_qty_per_sale ? Math.max(0.001, parseFloat(max_qty_per_sale)) : null;

        await db.query(`
            UPDATE Promotions SET
                discount_type = ?,
                discount_value = ?,
                max_qty_per_sale = ?,
                start_date = ?,
                end_date = ?,
                notes = ?
            WHERE id = ?
        `, [discType, discVal, maxQty, start_date, end_date, notes || null, id]);

        res.json({ status: 'SUCCESS', message: 'ئۆفەر بە سەرکەوتوویی نوێکرایەوە' });
    } catch (error) {
        console.error('Update Promotion Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

// Toggle active/inactive status
exports.togglePromotionStatus = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('UPDATE Promotions SET is_active = NOT is_active WHERE id = ?', [id]);
        res.json({ status: 'SUCCESS', message: 'دۆخی ئۆفەر گۆڕدرا' });
    } catch (error) {
        console.error('Toggle Promotion Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

// Delete a promotion
exports.deletePromotion = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM Promotions WHERE id = ?', [id]);
        res.json({ status: 'SUCCESS', message: 'ئۆفەر سڕایەوە' });
    } catch (error) {
        console.error('Delete Promotion Error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};
