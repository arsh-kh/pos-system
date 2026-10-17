require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const assert = require('assert');
const db = require('../db');

const PURCHASES_API = 'http://localhost:3001/api/purchases';
const CHECKOUT_API = 'http://localhost:3001/api/checkout';

async function runInventoryLandedCostTests() {
    console.log('=== دەستپێکردنی تاقیکردنەوەی تێچووی کڕین و کاروانەکانی FIFO (Module 3 Tests) ===\n');

    let prodIdA = null;
    let prodIdB = null;
    let supplierId = null;
    let invoiceId = null;

    try {
        // Setup supplier
        const [supRes] = await db.query("INSERT INTO Suppliers (name, phone) VALUES ('کۆمپانیای پشکنینی کاروانەکان', '07500000000')");
        supplierId = supRes.insertId;

        // Setup 2 products
        const barcodeA = `ITEM_A_${Date.now()}`;
        const barcodeB = `ITEM_B_${Date.now()}`;

        const [pARes] = await db.query(`
            INSERT INTO Products (name, barcode, cost_price, selling_price, stock)
            VALUES ('کاڵای یەکەم', ?, 1000, 2500, 0.000)
        `, [barcodeA]);
        prodIdA = pARes.insertId;

        const [pBRes] = await db.query(`
            INSERT INTO Products (name, barcode, cost_price, selling_price, stock)
            VALUES ('کاڵای دووەم', ?, 2000, 4000, 0.000)
        `, [barcodeB]);
        prodIdB = pBRes.insertId;

        // --- 1. Test Purchase with Additional Landed Cost & Fractional Quantities ---
        console.log('--- ١. تۆمارکردنی پسووڵەی کڕین بە تێچووی زیادەی گواستنەوە (Landed Cost) ---');
        // Item A: 2 kg * 1000 = 2000 IQD
        // Item B: 1 kg * 2000 = 2000 IQD
        // Items Subtotal = 4000 IQD
        // Additional Cost = 1000 IQD (Freight/Shipping)
        // Grand Total = 5000 IQD
        // Item A landed cost: 2000 + (1000 * 2000 / 4000) = 2500 -> 2500 / 2 kg = 1250 IQD/unit
        // Item B landed cost: 2000 + (1000 * 2000 / 4000) = 2500 -> 2500 / 1 kg = 2500 IQD/unit

        const purchaseRes = await fetch(PURCHASES_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                supplier_id: supplierId,
                invoice_number: `INV_TEST_${Date.now()}`,
                items: [
                    { product_id: prodIdA, quantity: 2, cost_price: 1000, selling_price: null }, // testing null selling_price preservation
                    { product_id: prodIdB, quantity: 1, cost_price: 2000, selling_price: 4500 } // testing selling_price update to 4500
                ],
                additional_cost: 1000,
                paid_amount: 5000,
                remaining_amount: 0,
                payment_method: 'CASH'
            })
        });

        assert.strictEqual(purchaseRes.status, 201, 'Purchase creation must return 201');
        const purchaseData = await purchaseRes.json();
        assert.strictEqual(purchaseData.status, 'SUCCESS', 'Purchase status must be SUCCESS');
        invoiceId = purchaseData.invoiceId;
        console.log('✓ پسووڵەی کڕین بە سەرکەوتوویی دروستکرا، ID:', invoiceId);

        // --- 2. Verify Landed Cost Per Unit in Batches ---
        console.log('\n--- ٢. پشکنینی تێچووی زیادە لەناو کاروانەکانی Product_Batches ---');
        const [batchesA] = await db.query('SELECT cost_price, remaining_quantity FROM Product_Batches WHERE product_id = ?', [prodIdA]);
        assert.strictEqual(batchesA.length, 1, 'Batch for product A must exist');
        assert.strictEqual(batchesA[0].cost_price, 1250, 'Product A unit cost must include freight (1000 + 250 = 1250)');
        assert.strictEqual(parseFloat(batchesA[0].remaining_quantity), 2.0, 'Batch A remaining quantity must be 2.0');
        console.log('✓ تێچووی یەکەی کاڵای A بە دروستی بە ١,٢٥٠ دینار تۆمارکرا (١٠٠٠ + ٢٥٠ کرێی گواستنەوە)');

        const [batchesB] = await db.query('SELECT cost_price, remaining_quantity FROM Product_Batches WHERE product_id = ?', [prodIdB]);
        assert.strictEqual(batchesB.length, 1, 'Batch for product B must exist');
        assert.strictEqual(batchesB[0].cost_price, 2500, 'Product B unit cost must include freight (2000 + 500 = 2500)');
        console.log('✓ تێچووی یەکەی کاڵای B بە دروستی بە ٢,٥٠٠ دینار تۆمارکرا (٢٠٠٠ + ٥٠٠ کرێی گواستنەوە)');

        // --- 3. Verify Existing Selling Price Preservation on Item A ---
        console.log('\n--- ٣. دڵنیابوونەوە لە نەسڕانەوەی نرخی فرۆشتنی پێشوو بەهۆی COALESCE ---');
        const [prodACheck] = await db.query('SELECT selling_price, cost_price FROM Products WHERE id = ?', [prodIdA]);
        assert.strictEqual(prodACheck[0].selling_price, 2500, 'Product A selling price must remain 2500 (not null or overwritten)');
        assert.strictEqual(prodACheck[0].cost_price, 1250, 'Product A catalog cost price must update to landed cost 1250');
        console.log('✓ نرخی فرۆشتنی کاڵای A وەک خۆی (٢,٥٠٠ د.ع) پارێزرا، و تێچووەکەی بوو بە ١,٢٥٠ د.ع');

        const [prodBCheck] = await db.query('SELECT selling_price FROM Products WHERE id = ?', [prodIdB]);
        assert.strictEqual(prodBCheck[0].selling_price, 4500, 'Product B selling price must be updated to 4500');
        console.log('✓ نرخی فرۆشتنی کاڵای B بە سەرکەوتوویی نوێکرایەوە بۆ ٤,٥٠٠ د.ع');

        // --- 4. Verify Checkout Profit Deducts Landed Cost ---
        console.log('\n--- ٤. پشکنینی لێدەرکردنی تێچووی گواستنەوە لە قازانجی فرۆشتندا ---');
        // Selling 1 unit of Item A: Sell price 2500, Landed Cost 1250 -> Profit must be exactly 1250 IQD
        const checkoutRes = await fetch(CHECKOUT_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: [{ barcode: barcodeA, quantity: 1, is_custom: false }],
                payment_method: 'CASH'
            })
        });
        assert.strictEqual(checkoutRes.status, 201, 'Checkout must succeed');
        const checkoutData = await checkoutRes.json();

        // Check Sale in DB
        const [saleCheck] = await db.query('SELECT total_amount, total_profit FROM Sales WHERE id = ?', [checkoutData.saleId]);
        assert.strictEqual(saleCheck[0].total_amount, 2500, 'Sale total must be 2500');
        assert.strictEqual(saleCheck[0].total_profit, 1250, 'Profit must accurately deduct landed cost (2500 - 1250 = 1250)');
        console.log('✓ قازانجی فرۆشتن بە وردی تێچووی گواستنەوەی لێدەرکرد (٢,٥٠٠ - ١,٢٥٠ = ١,٢٥٠ د.ع قازانج)');

        console.log('\n================================================================');
        console.log('🎉 هەموو تاقیکردنەوەکانی مۆدیوڵی ٣ (Inventory & Landed Cost) ١٠٠٪ سەرکەوتوون!');
        console.log('================================================================');
        process.exit(0);
    } catch (err) {
        console.error('❌ تاقیکردنەوە سەرکەوتوو نەبوو:', err);
        process.exit(1);
    } finally {
        // Clean up
        if (prodIdA && prodIdB) {
            try {
                await db.query('DELETE FROM Sale_Item_Batches WHERE batch_id IN (SELECT id FROM Product_Batches WHERE product_id IN (?, ?))', [prodIdA, prodIdB]);
                await db.query('DELETE FROM Sale_Items WHERE product_id IN (?, ?)', [prodIdA, prodIdB]);
                await db.query('DELETE FROM Product_Batches WHERE product_id IN (?, ?)', [prodIdA, prodIdB]);
                await db.query('DELETE FROM Purchase_Invoice_Items WHERE product_id IN (?, ?)', [prodIdA, prodIdB]);
                await db.query('DELETE FROM Products WHERE id IN (?, ?)', [prodIdA, prodIdB]);
            } catch (_) {}
        }
        if (invoiceId) {
            try { await db.query('DELETE FROM Purchase_Invoices WHERE id = ?', [invoiceId]); } catch (_) {}
        }
        if (supplierId) {
            try { await db.query('DELETE FROM Suppliers WHERE id = ?', [supplierId]); } catch (_) {}
        }
    }
}

runInventoryLandedCostTests();
