const db = require('../db');

// Safe BigInt parser to prevent floating point crashes
const safeBigInt = (val) => {
    const num = Math.round(Number(val) || 0);
    return BigInt(num);
};

// Ensure columns for custom invoice number and payment method exist
const ensureInvoicesSchema = async () => {
    try {
        try { await db.query("ALTER TABLE Purchase_Invoices ADD COLUMN invoice_number VARCHAR(100) DEFAULT NULL"); } catch (_) {}
        try { await db.query("ALTER TABLE Purchase_Invoices ADD COLUMN payment_method VARCHAR(50) DEFAULT 'CASH'"); } catch (_) {}
    } catch (err) {
        console.error('Invoice schema ensure error:', err.message);
    }
};
ensureInvoicesSchema();

exports.createPurchaseInvoice = async (req, res) => {
    const { supplier_id, paid_amount, remaining_amount, items, invoice_number, payment_method, invoice_date } = req.body;
    
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ status: 'ERROR', message: 'تکایە لانیکەم یەک کاڵا دیاری بکە' });
    }

    if (!supplier_id && (payment_method === 'DEBT' || Number(remaining_amount) > 0)) {
        return res.status(400).json({ status: 'ERROR', message: 'کڕین بە قەرز پێویستی بە هەڵبژاردنی کۆمپانیایە' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Calculate total amount from items safely
        let total_amount = 0n;
        for (const item of items) {
            total_amount += safeBigInt(item.cost_price) * safeBigInt(item.quantity);
        }

        // 1. Create Invoice
        const dateVal = invoice_date ? new Date(invoice_date) : new Date();
        const [invoiceResult] = await connection.query(
            'INSERT INTO Purchase_Invoices (supplier_id, total_amount, paid_amount, remaining_amount, invoice_number, payment_method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                supplier_id ? supplier_id : null, 
                total_amount.toString(), 
                safeBigInt(paid_amount).toString(), 
                safeBigInt(remaining_amount).toString(),
                invoice_number || null,
                payment_method || 'CASH',
                dateVal
            ]
        );
        const invoice_id = invoiceResult.insertId;

        // 2. Update Supplier Totals (Only if a supplier is linked)
        if (supplier_id) {
            await connection.query(
                'UPDATE Suppliers SET total_paid = total_paid + ?, total_remaining = total_remaining + ? WHERE id = ?',
                [safeBigInt(paid_amount).toString(), safeBigInt(remaining_amount).toString(), supplier_id]
            );
        }

        // 3. Insert Items and Update Stock & Cost Price with FIFO Batches
        for (const item of items) {
            await connection.query(
                'INSERT INTO Purchase_Invoice_Items (invoice_id, product_id, quantity, cost_price, selling_price) VALUES (?, ?, ?, ?, ?)',
                [invoice_id, item.product_id, item.quantity, item.cost_price, item.selling_price]
            );

            // Insert new FIFO batch
            const batchNum = item.batch_number || `BATCH-${invoice_id}-${item.product_id}`;
            await connection.query(`
                INSERT INTO Product_Batches (
                    product_id,
                    purchase_invoice_id,
                    batch_number,
                    initial_quantity,
                    remaining_quantity,
                    cost_price,
                    selling_price,
                    expiry_date,
                    status,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
            `, [
                item.product_id,
                invoice_id,
                batchNum,
                item.quantity,
                item.quantity,
                safeBigInt(item.cost_price).toString(),
                item.selling_price ? safeBigInt(item.selling_price).toString() : null,
                item.expiry_date || null,
                dateVal
            ]);

            await connection.query(
                'UPDATE Products SET stock = stock + ?, cost_price = ?, selling_price = ? WHERE id = ?',
                [item.quantity, item.cost_price, item.selling_price, item.product_id]
            );
        }

        await connection.commit();
        res.status(201).json({ status: 'SUCCESS', message: 'Purchase invoice created successfully', invoice_id });
    } catch (error) {
        await connection.rollback();
        console.error('Purchase Invoice Error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Failed to create purchase invoice' });
    } finally {
        connection.release();
    }
};

exports.getAllPurchaseInvoices = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT pi.*, 
                   COALESCE(s.name, 'کڕینی لۆکاڵی / بێ کۆمپانیا') as supplier_name, 
                   s.phone as supplier_phone,
                   COUNT(pii.id) as total_items
            FROM Purchase_Invoices pi 
            LEFT JOIN Suppliers s ON pi.supplier_id = s.id 
            LEFT JOIN Purchase_Invoice_Items pii ON pi.id = pii.invoice_id
            GROUP BY pi.id
            ORDER BY pi.created_at DESC
        `);
        res.json({ status: 'SUCCESS', data: rows });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.getPurchaseInvoiceDetails = async (req, res) => {
    const { id } = req.params;
    try {
        const [invoice] = await db.query(`
            SELECT pi.*, 
                   COALESCE(s.name, 'کڕینی لۆکاڵی / بێ کۆمپانیا') as supplier_name, 
                   s.phone as supplier_phone
            FROM Purchase_Invoices pi
            LEFT JOIN Suppliers s ON pi.supplier_id = s.id
            WHERE pi.id = ?
        `, [id]);

        if (invoice.length === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'Invoice not found' });
        }

        const [items] = await db.query(`
            SELECT pii.*, p.name as product_name, p.barcode, p.stock as current_stock
            FROM Purchase_Invoice_Items pii
            JOIN Products p ON pii.product_id = p.id
            WHERE pii.invoice_id = ?
        `, [id]);

        res.json({
            status: 'SUCCESS',
            data: {
                ...invoice[0],
                items
            }
        });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};
