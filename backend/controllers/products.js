const db = require('../db');
const { logAuditAction } = require('../middleware/auditLogger');

exports.getAllProducts = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.*, c.name as category_name 
            FROM Products p 
            LEFT JOIN Categories c ON p.category_id = c.id
            ORDER BY p.id DESC
        `);
        res.json({ status: 'SUCCESS', data: rows });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.addProduct = async (req, res) => {
    const { name, barcode, cost_price, selling_price, usd_price, stock, category_id, wholesale_price, expiry_date, low_stock_threshold } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO Products (name, barcode, cost_price, selling_price, usd_price, stock, category_id, wholesale_price, expiry_date, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                name, 
                barcode, 
                cost_price || 0, 
                selling_price, 
                usd_price || 0, 
                stock || 0, 
                category_id || null,
                wholesale_price || 0,
                expiry_date || null,
                low_stock_threshold !== undefined && low_stock_threshold !== '' ? parseInt(low_stock_threshold) : 5
            ]
        );

        // Audit log product creation
        await logAuditAction({
            req,
            action_type: 'PRODUCT_EDIT',
            entity_name: 'Products',
            entity_id: result.insertId,
            new_value: req.body,
            details: `زیادکردنی کاڵای نوێ "${name}" بە بارکۆدی (${barcode})، نرخی فرۆشتن: ${Number(selling_price).toLocaleString()} د.ع`
        });

        res.status(201).json({ status: 'SUCCESS', message: 'Product added successfully', id: result.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ status: 'ERROR', message: 'Barcode already exists' });
        }
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    const { id } = req.params;
    const { name, barcode, cost_price, selling_price, usd_price, stock, category_id, wholesale_price, expiry_date, low_stock_threshold } = req.body;
    try {
        // 1. Fetch current product before update to compare changes
        const [currentRows] = await db.query('SELECT * FROM Products WHERE id = ?', [id]);
        if (currentRows.length === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'Product not found' });
        }
        const oldP = currentRows[0];

        // 2. Perform database update
        await db.query(
            'UPDATE Products SET name=?, barcode=?, cost_price=?, selling_price=?, usd_price=?, stock=?, category_id=?, wholesale_price=?, expiry_date=?, low_stock_threshold=? WHERE id=?',
            [
                name, 
                barcode, 
                cost_price || 0, 
                selling_price, 
                usd_price || 0, 
                stock || 0, 
                category_id || null,
                wholesale_price || 0,
                expiry_date || null,
                low_stock_threshold !== undefined && low_stock_threshold !== '' ? parseInt(low_stock_threshold) : 5,
                id
            ]
        );

        // 3. Detect and log price changes
        const priceChanged = Number(oldP.selling_price) !== Number(selling_price) || Number(oldP.cost_price) !== Number(cost_price || 0);
        if (priceChanged) {
            await logAuditAction({
                req,
                action_type: 'PRICE_CHANGE',
                entity_name: 'Products',
                entity_id: id,
                old_value: { cost_price: Number(oldP.cost_price), selling_price: Number(oldP.selling_price) },
                new_value: { cost_price: Number(cost_price || 0), selling_price: Number(selling_price) },
                details: `گۆڕینی نرخی کاڵای "${name}": فرۆشتن لە ${Number(oldP.selling_price).toLocaleString()} بۆ ${Number(selling_price).toLocaleString()} د.ع`
            });
        }

        // 4. Detect and log manual stock adjustments
        const stockChanged = Number(oldP.stock) !== Number(stock || 0);
        if (stockChanged) {
            await logAuditAction({
                req,
                action_type: 'STOCK_ADJUSTMENT',
                entity_name: 'Products',
                entity_id: id,
                old_value: { stock: Number(oldP.stock) },
                new_value: { stock: Number(stock || 0) },
                details: `دەستکاریکردنی دەستیی مەوجودی کاڵای "${name}": لە ${oldP.stock} بۆ ${stock}`
            });
        }

        // 5. Log general product edit if other fields changed
        if (!priceChanged && !stockChanged) {
            await logAuditAction({
                req,
                action_type: 'PRODUCT_EDIT',
                entity_name: 'Products',
                entity_id: id,
                old_value: oldP,
                new_value: req.body,
                details: `دەستکاریکردنی زانیارییەکانی کاڵای "${name}"`
            });
        }

        res.json({ status: 'SUCCESS', message: 'Product updated successfully' });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    const { id } = req.params;
    const userRole = req.user?.role || req.headers['x-user-role'] || 'CASHIER';

    // Enforce Privilege: Only ADMIN can delete products
    if (userRole === 'CASHIER') {
        return res.status(403).json({ 
            status: 'ERROR', 
            message: 'کاشێر دەسەڵاتی سڕینەوەی کاڵای نییە. ئەم کردارە تەنها بۆ بەڕێوەبەر (Admin) ڕێپێدراوە.' 
        });
    }

    try {
        const [existing] = await db.query('SELECT * FROM Products WHERE id = ?', [id]);
        const deletedProduct = existing[0] || {};

        await db.query('DELETE FROM Products WHERE id = ?', [id]);

        // Audit log product deletion
        await logAuditAction({
            req,
            action_type: 'PRODUCT_DELETE',
            entity_name: 'Products',
            entity_id: id,
            old_value: deletedProduct,
            details: `سڕینەوەی یەکجارەکی کاڵای "${deletedProduct.name || id}" بە بارکۆدی (${deletedProduct.barcode || '-'}) لە کۆگا`
        });

        res.json({ status: 'SUCCESS', message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};
