const db = require('../db');
const { logAuditAction } = require('../middleware/auditLogger');
const { queueSyncEvent } = require('./sync');

// Safe BigInt parser to prevent floating point crashes
const safeBigInt = (val) => {
    const num = Math.round(Number(val) || 0);
    return BigInt(num);
};

// Ensure columns for custom invoice number, payment method, additional cost, units_per_box, and landed cost price exist
const ensureInvoicesSchema = async () => {
    try {
        try { await db.query("ALTER TABLE Purchase_Invoices ADD COLUMN invoice_number VARCHAR(100) DEFAULT NULL"); } catch (_) {}
        try { await db.query("ALTER TABLE Purchase_Invoices ADD COLUMN payment_method VARCHAR(50) DEFAULT 'CASH'"); } catch (_) {}
        try { await db.query("ALTER TABLE Purchase_Invoices ADD COLUMN additional_cost BIGINT NOT NULL DEFAULT 0"); } catch (_) {}
        try { await db.query("ALTER TABLE Purchase_Invoice_Items ADD COLUMN landed_cost_price BIGINT DEFAULT NULL"); } catch (_) {}
        try { await db.query("ALTER TABLE Purchase_Invoice_Items ADD COLUMN units_per_box DECIMAL(10,3) NOT NULL DEFAULT 1.000"); } catch (_) {}
        try { await db.query("ALTER TABLE Product_Batches ADD COLUMN units_per_box DECIMAL(10,3) NOT NULL DEFAULT 1.000"); } catch (_) {}
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

        // Calculate items subtotal from items safely, respecting client exact line_total to prevent integer rounding loss on boxes
        let items_subtotal = 0n;
        for (const item of items) {
            const rawCostNum = Math.max(0, Number(item.cost_price) || 0);
            const itemQtyNum = Math.max(0.001, parseFloat(item.quantity) || 1);
            const lineTotal = (item.line_total !== undefined && item.line_total !== null && Number(item.line_total) >= 0)
                ? safeBigInt(Math.round(Number(item.line_total)))
                : safeBigInt(Math.round(rawCostNum * itemQtyNum));
            items_subtotal += lineTotal;
        }

        // Grand Total = Items Subtotal + Additional Cost (Delivery / Lifting / Transport)
        let total_amount = items_subtotal + additionalCostBigInt;
        if (req.body.total_amount !== undefined && req.body.total_amount !== null && Number(req.body.total_amount) > 0) {
            total_amount = safeBigInt(Math.round(Number(req.body.total_amount)));
        }

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
            const rawCostNum = Math.max(0, Number(item.cost_price) || 0);
            const itemQtyNum = Math.max(0.001, parseFloat(item.quantity) || 1);
            const itemSubtotal = (item.line_total !== undefined && item.line_total !== null && Number(item.line_total) >= 0)
                ? safeBigInt(Math.round(Number(item.line_total)))
                : safeBigInt(Math.round(rawCostNum * itemQtyNum));

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

            const itemUnitsPerBox = Math.max(1, parseFloat(item.units_per_box) || 1);
            const sellingPriceVal = (item.selling_price !== undefined && item.selling_price !== null && item.selling_price !== '')
                ? safeBigInt(item.selling_price ?? item.sell_price).toString()
                : null;

            // Record raw supplier invoice cost, landed unit cost, packaging details and exact line total
            await connection.query(
                'INSERT INTO Purchase_Invoice_Items (invoice_id, product_id, quantity, cost_price, landed_cost_price, selling_price, units_per_box, unit_type, box_quantity, box_cost_price, line_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    invoice_id, 
                    item.product_id, 
                    itemQtyNum, 
                    safeBigInt(rawCostNum).toString(), 
                    landedUnitCost.toString(), 
                    sellingPriceVal,
                    itemUnitsPerBox,
                    item.unit_type || 'PIECE',
                    item.box_quantity ? item.box_quantity : null,
                    item.box_cost_price ? safeBigInt(item.box_cost_price).toString() : null,
                    itemSubtotal.toString()
                ]
            );

            // Insert new FIFO batch with landedUnitCost and specific units_per_box
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
                    units_per_box,
                    expiry_date,
                    status,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
            `, [
                item.product_id,
                invoice_id,
                batchNum,
                itemQtyNum,
                itemQtyNum,
                landedUnitCost.toString(),
                sellingPriceVal,
                itemUnitsPerBox,
                item.expiry_date || null,
                dateVal
            ]);

            // HISTORICAL PRICE & STOCK INTEGRITY (CORE ACCOUNTING):
            // DO NOT overwrite global Product flat prices/packaging (cost_price, box_cost_price, selling_price, units_per_box).
            // ONLY increment inventory stock!
            await connection.query(
                'UPDATE Products SET stock = stock + ? WHERE id = ?',
                [itemQtyNum, item.product_id]
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


exports.updatePurchaseInvoice = async (req, res) => {
    const { id } = req.params;
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

        // 1. Fetch current invoice with FOR UPDATE
        const [oldInvoices] = await connection.query('SELECT * FROM Purchase_Invoices WHERE id = ? FOR UPDATE', [id]);
        if (oldInvoices.length === 0) {
            await connection.rollback();
            return res.status(404).json({ status: 'ERROR', message: 'پسووڵەکە نەدۆزرایەوە' });
        }
        const oldInv = oldInvoices[0];

        // 2. Fetch current items of this invoice
        const [oldItems] = await connection.query('SELECT * FROM Purchase_Invoice_Items WHERE invoice_id = ?', [id]);

        // 3. Fetch batches created by this invoice
        const [oldBatches] = await connection.query('SELECT * FROM Product_Batches WHERE purchase_invoice_id = ?', [id]);

        // 4. Calculate items subtotal and new grand total safely
        let items_subtotal = 0n;
        for (const item of items) {
            const rawCostNum = Math.max(0, Number(item.cost_price) || 0);
            const itemQtyNum = Math.max(0.001, parseFloat(item.quantity) || 1);
            const lineTotal = (item.line_total !== undefined && item.line_total !== null && Number(item.line_total) >= 0)
                ? safeBigInt(Math.round(Number(item.line_total)))
                : safeBigInt(Math.round(rawCostNum * itemQtyNum));
            items_subtotal += lineTotal;
        }

        let total_amount = items_subtotal + additionalCostBigInt;
        if (req.body.total_amount !== undefined && req.body.total_amount !== null && Number(req.body.total_amount) > 0) {
            total_amount = safeBigInt(Math.round(Number(req.body.total_amount)));
        }

        const newPaidBigInt = safeBigInt(paid_amount);
        const newRemainingBigInt = safeBigInt(remaining_amount);

        // 5. Update Supplier Ledger (Reverse old invoice values, apply new invoice values)
        if (oldInv.supplier_id) {
            await connection.query(
                'UPDATE Suppliers SET total_paid = total_paid - ?, total_remaining = total_remaining - ? WHERE id = ?',
                [safeBigInt(oldInv.paid_amount).toString(), safeBigInt(oldInv.remaining_amount).toString(), oldInv.supplier_id]
            );
        }
        if (supplier_id) {
            await connection.query(
                'UPDATE Suppliers SET total_paid = total_paid + ?, total_remaining = total_remaining + ? WHERE id = ?',
                [newPaidBigInt.toString(), newRemainingBigInt.toString(), supplier_id]
            );
        }

        // 6. Proportional Landed Cost Allocation per Item
        let remainingAdditional = additionalCostBigInt;
        const oldItemMap = new Map();
        oldItems.forEach(oi => oldItemMap.set(Number(oi.product_id), oi));

        const oldBatchMap = new Map();
        oldBatches.forEach(ob => oldBatchMap.set(Number(ob.product_id), ob));

        const processedProductIds = new Set();
        const dateVal = invoice_date ? new Date(invoice_date) : new Date(oldInv.created_at);

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const pId = Number(item.product_id);
            processedProductIds.add(pId);

            const rawCostNum = Math.max(0, Number(item.cost_price) || 0);
            const itemQtyNum = Math.max(0.001, parseFloat(item.quantity) || 1);
            const itemSubtotal = (item.line_total !== undefined && item.line_total !== null && Number(item.line_total) >= 0)
                ? safeBigInt(Math.round(Number(item.line_total)))
                : safeBigInt(Math.round(rawCostNum * itemQtyNum));

            let allocatedCostForItem = 0n;
            if (additionalCostBigInt > 0n && items_subtotal > 0n) {
                if (i === items.length - 1) {
                    allocatedCostForItem = remainingAdditional;
                } else {
                    allocatedCostForItem = (additionalCostBigInt * itemSubtotal) / items_subtotal;
                    remainingAdditional -= allocatedCostForItem;
                }
            }

            const additionalPerUnit = itemQtyNum > 0 ? Math.round(Number(allocatedCostForItem) / itemQtyNum) : 0;
            const landedUnitCost = safeBigInt(rawCostNum + additionalPerUnit);
            const itemUnitsPerBox = Math.max(1, parseFloat(item.units_per_box) || 1);
            const sellingPriceVal = (item.selling_price !== undefined && item.selling_price !== null && item.selling_price !== '')
                ? safeBigInt(item.selling_price ?? item.sell_price).toString()
                : null;

            if (oldItemMap.has(pId)) {
                // Existing item: Update item and only adjust inventory by DELTA
                const existingItem = oldItemMap.get(pId);
                const oldQty = parseFloat(existingItem.quantity) || 0;
                const qtyDelta = itemQtyNum - oldQty;

                await connection.query(`
                    UPDATE Purchase_Invoice_Items 
                    SET quantity = ?, cost_price = ?, landed_cost_price = ?, selling_price = ?, units_per_box = ?, unit_type = ?, box_quantity = ?, box_cost_price = ?, line_total = ?
                    WHERE id = ?
                `, [
                    itemQtyNum,
                    safeBigInt(rawCostNum).toString(),
                    landedUnitCost.toString(),
                    sellingPriceVal,
                    itemUnitsPerBox,
                    item.unit_type || 'PIECE',
                    item.box_quantity ? item.box_quantity : null,
                    item.box_cost_price ? safeBigInt(item.box_cost_price).toString() : null,
                    itemSubtotal.toString(),
                    existingItem.id
                ]);

                // Update product stock with delta only (if delta == 0, stock is completely unchanged!)
                if (qtyDelta !== 0) {
                    await connection.query('UPDATE Products SET stock = stock + ? WHERE id = ?', [qtyDelta, pId]);
                }

                // Update Batch
                if (oldBatchMap.has(pId)) {
                    const batch = oldBatchMap.get(pId);
                    await connection.query(`
                        UPDATE Product_Batches 
                        SET initial_quantity = initial_quantity + ?,
                            remaining_quantity = remaining_quantity + ?,
                            cost_price = ?,
                            selling_price = ?,
                            units_per_box = ?
                        WHERE id = ?
                    `, [
                        qtyDelta,
                        qtyDelta,
                        landedUnitCost.toString(),
                        sellingPriceVal,
                        itemUnitsPerBox,
                        batch.id
                    ]);
                }
            } else {
                // NEW ITEM added to invoice: Insert item, create batch, add full quantity to stock
                await connection.query(`
                    INSERT INTO Purchase_Invoice_Items (
                        invoice_id, product_id, quantity, cost_price, landed_cost_price, selling_price, units_per_box, unit_type, box_quantity, box_cost_price, line_total
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    id,
                    pId,
                    itemQtyNum,
                    safeBigInt(rawCostNum).toString(),
                    landedUnitCost.toString(),
                    sellingPriceVal,
                    itemUnitsPerBox,
                    item.unit_type || 'PIECE',
                    item.box_quantity ? item.box_quantity : null,
                    item.box_cost_price ? safeBigInt(item.box_cost_price).toString() : null,
                    itemSubtotal.toString()
                ]);

                const batchNum = item.batch_number || `BATCH-${id}-${pId}`;
                await connection.query(`
                    INSERT INTO Product_Batches (
                        product_id, purchase_invoice_id, batch_number, initial_quantity, remaining_quantity, cost_price, selling_price, units_per_box, expiry_date, status, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
                `, [
                    pId,
                    id,
                    batchNum,
                    itemQtyNum,
                    itemQtyNum,
                    landedUnitCost.toString(),
                    sellingPriceVal,
                    itemUnitsPerBox,
                    item.expiry_date || null,
                    dateVal
                ]);

                await connection.query('UPDATE Products SET stock = stock + ? WHERE id = ?', [itemQtyNum, pId]);
            }
        }

        // Handle removed items
        for (const [oldPId, oldItem] of oldItemMap.entries()) {
            if (!processedProductIds.has(oldPId)) {
                const oldQty = parseFloat(oldItem.quantity) || 0;
                await connection.query('UPDATE Products SET stock = stock - ? WHERE id = ?', [oldQty, oldPId]);
                if (oldBatchMap.has(oldPId)) {
                    const b = oldBatchMap.get(oldPId);
                    await connection.query('DELETE FROM Product_Batches WHERE id = ?', [b.id]);
                }
                await connection.query('DELETE FROM Purchase_Invoice_Items WHERE id = ?', [oldItem.id]);
            }
        }

        // 7. Update Invoice Record
        await connection.query(`
            UPDATE Purchase_Invoices 
            SET supplier_id = ?, total_amount = ?, paid_amount = ?, remaining_amount = ?, invoice_number = ?, payment_method = ?, additional_cost = ?, created_at = ?
            WHERE id = ?
        `, [
            supplier_id,
            total_amount.toString(),
            newPaidBigInt.toString(),
            newRemainingBigInt.toString(),
            invoice_number || oldInv.invoice_number,
            payment_method || oldInv.payment_method,
            additionalCostBigInt.toString(),
            dateVal,
            id
        ]);

        await connection.commit();

        // Audit Logging
        try {
            await logAuditAction({
                req,
                action_type: 'PURCHASE_INVOICE_UPDATED',
                entity_name: 'Purchase_Invoices',
                entity_id: id,
                details: `دەستکاریکردنی پسووڵەی کڕین #${invoice_number || id}، کۆی نوێ: ${Number(total_amount).toLocaleString()} د.ع`
            });
        } catch (_) {}

        // Cloud & Offline Sync Event
        try {
            await queueSyncEvent({
                entity_type: 'PURCHASE_INVOICE',
                entity_id: id,
                action_type: 'UPDATE',
                payload: {
                    invoice_id: id,
                    supplier_id,
                    total_amount: total_amount.toString(),
                    paid_amount: newPaidBigInt.toString(),
                    remaining_amount: newRemainingBigInt.toString(),
                    additional_cost: additionalCostBigInt.toString(),
                    items_count: items.length
                }
            });
        } catch (_) {}

        res.json({
            status: 'SUCCESS',
            message: 'پسووڵەی کڕین بە سەرکەوتوویی نوێکرایەوە',
            invoice_id: id,
            total_amount: total_amount.toString(),
            additional_cost: additionalCostBigInt.toString()
        });

    } catch (error) {
        await connection.rollback();
        console.error('Update Purchase Invoice Error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Failed to update purchase invoice: ' + error.message });
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
            SELECT pii.*, p.name as product_name, p.barcode, p.box_barcode, p.is_weighted, p.unit, p.stock as current_stock
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

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

exports.generateInvoicePdf = async (req, res) => {
    let tempHtml = null;
    let tempPdf = null;
    try {
        const { htmlContent } = req.body;
        if (!htmlContent) {
            return res.status(400).json({ status: 'ERROR', message: 'htmlContent is required' });
        }

        const potentialChromePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            process.env.CHROME_BIN || '',
            process.env.PUPPETEER_EXECUTABLE_PATH || ''
        ].filter(Boolean);

        const chromePath = potentialChromePaths.find(p => fs.existsSync(p));
        if (!chromePath) {
            return res.status(500).json({ status: 'ERROR', message: 'Google Chrome executable not found on host machine' });
        }

        const id = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        tempHtml = path.join(os.tmpdir(), `inv_html_${id}.html`);
        tempPdf = path.join(os.tmpdir(), `inv_pdf_${id}.pdf`);

        fs.writeFileSync(tempHtml, htmlContent, 'utf8');

        execSync(`"${chromePath}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${tempPdf}" "${tempHtml}"`, {
            timeout: 15000
        });

        if (!fs.existsSync(tempPdf)) {
            throw new Error('PDF output file was not created');
        }

        const pdfBuffer = fs.readFileSync(tempPdf);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="invoice.pdf"');
        res.send(pdfBuffer);
    } catch (err) {
        console.error('generateInvoicePdf error:', err);
        res.status(500).json({ status: 'ERROR', message: 'Failed to generate PDF: ' + err.message });
    } finally {
        if (tempHtml && fs.existsSync(tempHtml)) {
            try { fs.unlinkSync(tempHtml); } catch (_) {}
        }
        if (tempPdf && fs.existsSync(tempPdf)) {
            try { fs.unlinkSync(tempPdf); } catch (_) {}
        }
    }
};

