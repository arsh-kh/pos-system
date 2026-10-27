const db = require('../db');
const { logAuditAction } = require('../middleware/auditLogger');
const { queueSyncEvent } = require('./sync');

// Safe BigInt parser to prevent floating point crashes
const safeBigInt = (val) => {
    const num = Math.round(Number(val) || 0);
    return BigInt(num);
};

// Ensure columns for custom invoice number, payment method, additional cost, and landed cost price exist
const ensureInvoicesSchema = async () => {
    try {
        try { await db.query("ALTER TABLE Purchase_Invoices ADD COLUMN invoice_number VARCHAR(100) DEFAULT NULL"); } catch (_) {}
        try { await db.query("ALTER TABLE Purchase_Invoices ADD COLUMN payment_method VARCHAR(50) DEFAULT 'CASH'"); } catch (_) {}
        try { await db.query("ALTER TABLE Purchase_Invoices ADD COLUMN additional_cost BIGINT NOT NULL DEFAULT 0"); } catch (_) {}
        try { await db.query("ALTER TABLE Purchase_Invoice_Items ADD COLUMN landed_cost_price BIGINT DEFAULT NULL"); } catch (_) {}
    } catch (err) {
        console.error('Invoice schema ensure error:', err.message);
    }
};
ensureInvoicesSchema();

exports.createPurchaseInvoice = async (req, res) => {
    const { supplier_id, paid_amount, remaining_amount, items, invoice_number, payment_method, invoice_date, additional_cost } = req.body;
    
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ status: 'ERROR', message: 'تکایە لانیکەم یەک کاڵا دیاری بکە' });
    }

    if (!supplier_id) {
        return res.status(400).json({ status: 'ERROR', message: 'تکایە سەرەتا کۆمپانیا دیاری بکە' });
    }

    const additionalCostBigInt = safeBigInt(additional_cost || 0);
    if (additionalCostBigInt < 0n) {
        return res.status(400).json({ status: 'ERROR', message: 'تێچووی زیادە ناتوانێت کەمتر بێت لە سفر' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Calculate items subtotal from items safely (supports fractional quantities like 1.5 kg)
        let items_subtotal = 0n;
        for (const item of items) {
            const rawCostNum = Math.max(0, Math.round(Number(item.cost_price) || 0));
            const itemQtyNum = Math.max(0.001, parseFloat(item.quantity) || 1);
            items_subtotal += safeBigInt(Math.round(rawCostNum * itemQtyNum));
        }

        // Grand Total = Items Subtotal + Additional Cost (Delivery / Lifting / Transport)
        const total_amount = items_subtotal + additionalCostBigInt;

        // 1. Create Invoice
        const dateVal = invoice_date ? new Date(invoice_date) : new Date();
        const [invoiceResult] = await connection.query(
            'INSERT INTO Purchase_Invoices (supplier_id, total_amount, paid_amount, remaining_amount, invoice_number, payment_method, additional_cost, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                supplier_id ? supplier_id : null, 
                total_amount.toString(), 
                safeBigInt(paid_amount).toString(), 
                safeBigInt(remaining_amount).toString(),
                invoice_number || null,
                payment_method || 'CASH',
                additionalCostBigInt.toString(),
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

        // 3. Proportional Landed Cost Allocation per Item
        // Sum of all allocated fractions must exactly equal additionalCostBigInt
        let remainingAdditional = additionalCostBigInt;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const rawCostNum = Math.max(0, Math.round(Number(item.cost_price) || 0));
            const itemQtyNum = Math.max(0.001, parseFloat(item.quantity) || 1);
            const itemSubtotal = safeBigInt(Math.round(rawCostNum * itemQtyNum));

            let allocatedCostForItem = 0n;
            if (additionalCostBigInt > 0n && items_subtotal > 0n) {
                if (i === items.length - 1) {
                    // Final item absorbs any fractional remainder to guarantee exact sum
                    allocatedCostForItem = remainingAdditional;
                } else {
                    allocatedCostForItem = (additionalCostBigInt * itemSubtotal) / items_subtotal;
                    remainingAdditional -= allocatedCostForItem;
                }
            }

            const additionalPerUnit = itemQtyNum > 0 ? Math.round(Number(allocatedCostForItem) / itemQtyNum) : 0;
            const landedUnitCost = safeBigInt(rawCostNum + additionalPerUnit);

            // Record both raw supplier invoice cost and landed unit cost
            await connection.query(
                'INSERT INTO Purchase_Invoice_Items (invoice_id, product_id, quantity, cost_price, landed_cost_price, selling_price) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    invoice_id, 
                    item.product_id, 
                    itemQtyNum, 
                    safeBigInt(rawCostNum).toString(), 
                    landedUnitCost.toString(), 
                    item.selling_price ? safeBigInt(item.selling_price).toString() : null
                ]
            );

            // Insert new FIFO batch with landedUnitCost so Checkout sales deduct accurate cost
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
                itemQtyNum,
                itemQtyNum,
                landedUnitCost.toString(),
                item.selling_price ? safeBigInt(item.selling_price).toString() : null,
                item.expiry_date || null,
                dateVal
            ]);

            // Update Products stock, update cost_price to landedUnitCost, box_cost_price if provided, and only update selling_price if provided
            const newSellPrice = item.selling_price ? safeBigInt(item.selling_price).toString() : null;
            const newBoxCost = item.box_cost_price ? safeBigInt(item.box_cost_price).toString() : null;
            await connection.query(
                'UPDATE Products SET stock = stock + ?, cost_price = ?, box_cost_price = COALESCE(?, box_cost_price), selling_price = COALESCE(?, selling_price) WHERE id = ?',
                [itemQtyNum, landedUnitCost.toString(), newBoxCost, newSellPrice, item.product_id]
            );
        }

        await connection.commit();

        // Audit Logging
        try {
            await logAuditAction({
                req,
                action_type: 'PURCHASE_INVOICE_CREATED',
                entity_name: 'Purchase_Invoices',
                entity_id: invoice_id,
                details: `تۆمارکردنی پسووڵەی کڕین #${invoice_number || invoice_id} بە بڕی ${Number(total_amount).toLocaleString()} د.ع (تێچووی زیادە: ${Number(additionalCostBigInt).toLocaleString()} د.ع)`
            });
        } catch (_) {}

        // Cloud & Offline Sync Event
        try {
            await queueSyncEvent({
                entity_type: 'PURCHASE_INVOICE',
                entity_id: invoice_id,
                action_type: 'CREATE',
                payload: {
                    invoice_id,
                    supplier_id,
                    total_amount: total_amount.toString(),
                    paid_amount: safeBigInt(paid_amount).toString(),
                    remaining_amount: safeBigInt(remaining_amount).toString(),
                    additional_cost: additionalCostBigInt.toString(),
                    items_count: items.length
                }
            });
        } catch (_) {}

        res.status(201).json({ 
            status: 'SUCCESS', 
            message: 'پسووڵەی کڕین بە سەرکەوتوویی تۆمارکرا', 
            invoice_id,
            total_amount: total_amount.toString(),
            additional_cost: additionalCostBigInt.toString()
        });
    } catch (error) {
        await connection.rollback();
        console.error('Purchase Invoice Error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Failed to create purchase invoice: ' + error.message });
    } finally {
        connection.release();
    }
};

exports.getAllPurchaseInvoices = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT pi.*, 
                   COALESCE(s.name, 'کڕینی ناوخۆیی / بێ کۆمپانیا') as supplier_name, 
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
                   COALESCE(s.name, 'کڕینی ناوخۆیی / بێ کۆمپانیا') as supplier_name, 
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
