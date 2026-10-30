const db = require('../db');
const { logAuditAction } = require('../middleware/auditLogger');

const ensureProductsSchema = async () => {
    try {
        await db.query("ALTER TABLE Products ADD COLUMN box_cost_price BIGINT DEFAULT NULL");
    } catch (_) {}
};
ensureProductsSchema();

exports.getAllProducts = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.*, 
                   COALESCE((
                       SELECT pb.units_per_box 
                       FROM Product_Batches pb 
                       WHERE pb.product_id = p.id AND pb.status = 'ACTIVE' AND pb.remaining_quantity > 0 
                       ORDER BY pb.created_at ASC, pb.id ASC 
                       LIMIT 1
                   ), 1) AS active_units_per_box,
                   (
                       SELECT pb.selling_price 
                       FROM Product_Batches pb 
                       WHERE pb.product_id = p.id AND pb.status = 'ACTIVE' AND pb.remaining_quantity > 0 
                       ORDER BY pb.created_at ASC, pb.id ASC 
                       LIMIT 1
                   ) AS active_batch_selling_price,
                   c.name as category_name 
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
    const { name, barcode, cost_price, selling_price, usd_price, stock, category_id, wholesale_price, expiry_date, low_stock_threshold, box_barcode, units_per_box, is_weighted, unit, box_cost_price } = req.body;
    try {
        const cleanBoxBarcode = box_barcode && String(box_barcode).trim() !== '' ? String(box_barcode).trim() : null;
        const cleanUnitsPerBox = Math.max(1, parseFloat(units_per_box) || 1);
        const weightedFlag = Boolean(is_weighted || unit === 'کگم') ? 1 : 0;
        const cleanUnit = weightedFlag ? 'کگم' : (unit || 'دانە');
        const cleanBoxCostPrice = (box_cost_price !== undefined && box_cost_price !== null && box_cost_price !== '') 
            ? Math.round(Number(box_cost_price)) 
            : null;

        const [result] = await db.query(
            'INSERT INTO Products (name, barcode, cost_price, selling_price, usd_price, stock, category_id, wholesale_price, expiry_date, low_stock_threshold, box_barcode, units_per_box, is_weighted, unit, box_cost_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
                cleanBoxBarcode,
                cleanUnitsPerBox,
                weightedFlag,
                cleanUnit,
                cleanBoxCostPrice
            ]
        );

        // If product is added with initial stock, create initial FIFO batch
        if (Number(stock) > 0) {
            await db.query(`
                INSERT INTO Product_Batches (
                    product_id,
                    batch_number,
                    initial_quantity,
                    remaining_quantity,
                    cost_price,
                    selling_price,
                    units_per_box,
                    expiry_date,
                    status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
            `, [
                result.insertId,
                `INIT-${result.insertId}`,
                stock,
                stock,
                BigInt(Math.round(Number(cost_price) || 0)).toString(),
                BigInt(Math.round(Number(selling_price) || 0)).toString(),
                cleanUnitsPerBox,
                expiry_date || null
            ]);
        }

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
            return res.status(400).json({ status: 'ERROR', message: 'بارکۆدی دانە یان بارکۆدی کارتۆن پێشتر تۆمارکراوە' });
        }
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    const { id } = req.params;
    const { name, barcode, cost_price, selling_price, usd_price, stock, category_id, wholesale_price, expiry_date, low_stock_threshold, box_barcode, units_per_box, is_weighted, unit, box_cost_price } = req.body;
    try {
        // 1. Fetch current product before update to compare changes
        const [currentRows] = await db.query('SELECT * FROM Products WHERE id = ?', [id]);
        if (currentRows.length === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'Product not found' });
        }
        const oldP = currentRows[0];

        const cleanBoxBarcode = box_barcode && String(box_barcode).trim() !== '' ? String(box_barcode).trim() : null;
        const cleanUnitsPerBox = Math.max(1, parseFloat(units_per_box) || 1);
        const weightedFlag = (is_weighted !== undefined || unit !== undefined) 
            ? (Boolean(is_weighted || unit === 'کگم') ? 1 : 0) 
            : (oldP.is_weighted || 0);
        const cleanUnit = weightedFlag ? 'کگم' : (unit || oldP.unit || 'دانە');
        const cleanBoxCostPrice = (box_cost_price !== undefined && box_cost_price !== null && box_cost_price !== '') 
            ? Math.round(Number(box_cost_price)) 
            : (oldP.box_cost_price || null);

        // 2. Perform database update
        await db.query(
            'UPDATE Products SET name=?, barcode=?, cost_price=?, selling_price=?, usd_price=?, stock=?, category_id=?, wholesale_price=?, expiry_date=?, low_stock_threshold=?, box_barcode=?, units_per_box=?, is_weighted=?, unit=?, box_cost_price=? WHERE id=?',
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
                cleanBoxBarcode,
                cleanUnitsPerBox,
                weightedFlag,
                cleanUnit,
                cleanBoxCostPrice,
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

        // 4. Detect and log manual stock adjustments, ensuring FIFO batch synchronization
        const stockChanged = Number(oldP.stock) !== Number(stock || 0);
        if (stockChanged) {
            const stockDiff = Number(stock || 0) - Number(oldP.stock || 0);
            if (stockDiff > 0) {
                await db.query(`
                    INSERT INTO Product_Batches (
                        product_id,
                        batch_number,
                        initial_quantity,
                        remaining_quantity,
                        cost_price,
                        selling_price,
                        units_per_box,
                        expiry_date,
                        status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
                `, [
                    id,
                    `ADJ-${id}-${Date.now().toString().slice(-6)}`,
                    stockDiff,
                    stockDiff,
                    BigInt(Math.round(Number(cost_price || oldP.cost_price) || 0)).toString(),
                    BigInt(Math.round(Number(selling_price || oldP.selling_price) || 0)).toString(),
                    cleanUnitsPerBox,
                    expiry_date || oldP.expiry_date || null
                ]);
            }

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
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ 
                status: 'ERROR', 
                message: 'ناتوانرێت ئەم کاڵایە بسڕدرێتەوە چونکە لە پسووڵەکانی پێشووی فرۆشتن یان کڕیندا بوونی هەیە. دەتوانیت مەوجودەکەی بکەیت بە ٠.' 
            });
        }
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.getProductBatches = async (req, res) => {
    const { id } = req.params;
    try {
        const [batches] = await db.query(`
            SELECT b.*, 
                   pi.invoice_number, 
                   COALESCE(s.name, 'مەخزەنی سەرەتایی / کڕینی ناوخۆیی') as supplier_name
            FROM Product_Batches b
            LEFT JOIN Purchase_Invoices pi ON b.purchase_invoice_id = pi.id
            LEFT JOIN Suppliers s ON pi.supplier_id = s.id
            WHERE b.product_id = ?
            ORDER BY b.created_at ASC, b.id ASC
        `, [id]);
        res.json({ status: 'SUCCESS', data: batches });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

