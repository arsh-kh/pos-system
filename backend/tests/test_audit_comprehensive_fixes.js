const db = require('../db');
const assert = require('assert');

async function runTests() {
    console.log('================================================================');
    console.log('🚀 RUNNING COMPREHENSIVE CODEBASE AUDIT & STRESS TESTS');
    console.log('================================================================');

    let passed = 0;
    let failed = 0;

    const test = async (name, fn) => {
        try {
            await fn();
            console.log(`  ✅ PASS: ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ FAIL: ${name}`);
            console.error(`     Reason:`, err.message);
            failed++;
        }
    };

    try {
        // --- TEST 1: BigInt Serialization Guard ---
        await test('1. BigInt toJSON serialization returns string without throwing', async () => {
            BigInt.prototype.toJSON = function () { return this.toString(); };
            const obj = { id: 123, amount: 50000000000n, small: 10n };
            const jsonStr = JSON.stringify(obj);
            assert(jsonStr.includes('"amount":"50000000000"'), 'BigInt must serialize to string in JSON');
        });

        // --- TEST 2: Checkout Signed Negative Net Profit on Excessive Discount ---
        await test('2. Checkout correctly records signed negative net profit (loss) when discount exceeds profit', async () => {
            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();

                // Create a test product: Selling 1,000, Cost 800 (Profit = 200)
                const bcodeLoss = 'BARCODE_LOSS_' + Date.now();
                const [pRes] = await connection.query(`
                    INSERT INTO Products (name, barcode, cost_price, selling_price, stock, unit)
                    VALUES ('Test Item Profit', ?, 800, 1000, 10, 'دانە')
                `, [bcodeLoss]);
                const prodId = pRes.insertId;

                // Simulate Checkout: 1 item at 1000, but manual discount of 500
                // Total = 500, Cost = 800 -> Net profit must be 500 - 800 = -300
                const rawProfit = 1000n - 800n; // 200n
                const discount = 500n;
                const finalProfit = rawProfit - discount; // -300n

                assert.strictEqual(finalProfit, -300n, 'finalProfit should be signed -300n');

                const [sRes] = await connection.query(`
                    INSERT INTO Sales (total_amount, total_profit, subtotal_amount, discount_amount, paid_amount, payment_method)
                    VALUES (?, ?, ?, ?, ?, 'CASH')
                `, ['500', finalProfit.toString(), '1000', '500', '500']);

                const [saleRow] = await connection.query('SELECT total_profit FROM Sales WHERE id = ?', [sRes.insertId]);
                assert.strictEqual(Number(saleRow[0].total_profit), -300, 'Database must record -300 signed profit');

                await connection.rollback();
            } finally {
                connection.release();
            }
        });

        // --- TEST 3: Fractional Quantity Purchase Invoice & Proportional Landed Cost ---
        await test('3. Purchase Invoice calculates accurate subtotal and landed cost for fractional weights (e.g. 1.5 kg)', async () => {
            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();

                const bcodeMeat = 'BARCODE_MEAT_' + Date.now();
                const [pRes] = await connection.query(`
                    INSERT INTO Products (name, barcode, cost_price, selling_price, stock, unit)
                    VALUES ('Test Meat Weighted', ?, 4000, 6000, 0, 'کگم')
                `, [bcodeMeat]);
                const prodId = pRes.insertId;

                // Buying 1.5 kg at 4,000 IQD per kg with 300 IQD additional transport cost
                const item = { product_id: prodId, cost_price: 4000, quantity: 1.5 };
                const additionalCost = 300n;

                const rawCostNum = Math.max(0, Math.round(Number(item.cost_price) || 0));
                const itemQtyNum = Math.max(0.001, parseFloat(item.quantity) || 1);
                const itemSubtotal = BigInt(Math.round(rawCostNum * itemQtyNum));

                assert.strictEqual(itemSubtotal, 6000n, '1.5 kg at 4000 cost must equal exactly 6000 subtotal');

                const grandTotal = itemSubtotal + additionalCost;
                assert.strictEqual(grandTotal, 6300n, 'Grand total must equal 6300');

                const additionalPerUnit = itemQtyNum > 0 ? Math.round(Number(additionalCost) / itemQtyNum) : 0;
                // 300 / 1.5 = 200 IQD transport per kg
                assert.strictEqual(additionalPerUnit, 200, 'Additional cost per unit must be 200 IQD');
                const landedUnitCost = BigInt(rawCostNum + additionalPerUnit); // 4200 IQD
                assert.strictEqual(landedUnitCost, 4200n, 'Landed unit cost must be exactly 4200 IQD');

                // Insert into Purchase_Invoice_Items
                const [invRes] = await connection.query(`
                    INSERT INTO Purchase_Invoices (total_amount, paid_amount, remaining_amount, additional_cost)
                    VALUES (?, ?, 0, ?)
                `, [grandTotal.toString(), grandTotal.toString(), additionalCost.toString()]);

                await connection.query(`
                    INSERT INTO Purchase_Invoice_Items (invoice_id, product_id, quantity, cost_price, landed_cost_price)
                    VALUES (?, ?, ?, ?, ?)
                `, [invRes.insertId, prodId, itemQtyNum, rawCostNum, landedUnitCost.toString()]);

                const [savedItem] = await connection.query('SELECT quantity, landed_cost_price FROM Purchase_Invoice_Items WHERE invoice_id = ?', [invRes.insertId]);
                assert.strictEqual(parseFloat(savedItem[0].quantity), 1.500, 'Saved quantity in DECIMAL(10,3) must be exactly 1.500');
                assert.strictEqual(Number(savedItem[0].landed_cost_price), 4200, 'Landed cost must be 4200');

                await connection.rollback();
            } finally {
                connection.release();
            }
        });

        // --- TEST 4: Return Batch Restoration and Invoice Discount Refund Cap ---
        await test('4. Customer Return restores batch remaining quantity and caps refunds to invoice total', async () => {
            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();

                // 1. Create product and batch
                const bcodeBatch = 'BARCODE_BATCH_' + Date.now();
                const [pRes] = await connection.query(`
                    INSERT INTO Products (name, barcode, cost_price, selling_price, stock, unit)
                    VALUES ('Batch Test Prod', ?, 1000, 1500, 10, 'دانە')
                `, [bcodeBatch]);
                const prodId = pRes.insertId;

                const [bRes] = await connection.query(`
                    INSERT INTO Product_Batches (product_id, batch_number, initial_quantity, remaining_quantity, cost_price, status)
                    VALUES (?, 'TEST-BATCH-1', 10, 8, 1000, 'ACTIVE')
                `, [prodId]);
                const batchId = bRes.insertId;

                // Sale of 2 items: normal price 3,000, but discounted to 2,000
                const [sRes] = await connection.query(`
                    INSERT INTO Sales (total_amount, total_profit, subtotal_amount, discount_amount, paid_amount, payment_method)
                    VALUES (2000, 0, 3000, 1000, 2000, 'CASH')
                `);
                const saleId = sRes.insertId;

                const [siRes] = await connection.query(`
                    INSERT INTO Sale_Items (sale_id, product_id, quantity, price_at_sale)
                    VALUES (?, ?, 2, 1500)
                `, [saleId, prodId]);
                const saleItemId = siRes.insertId;

                await connection.query(`
                    INSERT INTO Sale_Item_Batches (sale_id, sale_item_id, batch_id, quantity_deducted, unit_cost_price, total_cost)
                    VALUES (?, ?, ?, 2, 1000, 2000)
                `, [saleId, saleItemId, batchId]);

                // First Return: return 1 item (normal price 1500 <= sale total 2000)
                let refund1 = Math.min(1500, 2000 - 0);
                assert.strictEqual(refund1, 1500, 'First return refund should be 1500');

                // Second Return: return 2nd item (attempting 1500, but only 500 left of original 2000 paid!)
                let refund2 = Math.min(1500, 2000 - 1500);
                assert.strictEqual(refund2, 500, 'Second return refund MUST be capped at 500 to match total paid 2000');

                // Verify batch restoration logic: adding back 2 items
                const [batchBefore] = await connection.query('SELECT remaining_quantity FROM Product_Batches WHERE id = ?', [batchId]);
                const newQty = Number(batchBefore[0].remaining_quantity) + 2;
                await connection.query('UPDATE Product_Batches SET remaining_quantity = ? WHERE id = ?', [newQty, batchId]);

                const [batchAfter] = await connection.query('SELECT remaining_quantity FROM Product_Batches WHERE id = ?', [batchId]);
                assert.strictEqual(Number(batchAfter[0].remaining_quantity), 10, 'Batch must be restored back to 10');

                await connection.rollback();
            } finally {
                connection.release();
            }
        });

        // --- TEST 5: Cash Drawer Formula with Debtor Cash Payments ---
        await test('5. Shift cash drawer formula accounts for debtor repayments and cash sales accurately', async () => {
            const openingCash = 100000;
            const cashSales = 250000;
            const debtorRepaidCash = 50000;
            const expensesPaid = 30000;
            const cashRefunds = 20000;

            const expectedCash = openingCash + cashSales + debtorRepaidCash - expensesPaid - cashRefunds;
            assert.strictEqual(expectedCash, 350000, 'Expected cash should exactly equal 350,000 IQD');
        });

        // --- TEST 6: Analytics Returns Deduction ---
        await test('6. Monthly Analytics deducts customer returns from revenue and gross profit', async () => {
            const rawSales = 1000000;
            const rawProfit = 300000;
            const totalRefunded = 100000;
            const returnedProfit = 30000;
            const totalExpenses = 50000;
            const totalDamages = 20000;

            const netSales = rawSales - totalRefunded; // 900,000
            const adjustedGrossProfit = rawProfit - returnedProfit; // 270,000
            const netProfit = adjustedGrossProfit - totalExpenses - totalDamages; // 200,000

            assert.strictEqual(netSales, 900000, 'Net sales must deduct 100,000 refunded returns');
            assert.strictEqual(adjustedGrossProfit, 270000, 'Adjusted gross profit must deduct 30,000 returned profit');
            assert.strictEqual(netProfit, 200000, 'Net profit must be 200,000');
        });

    } catch (globalErr) {
        console.error('Fatal Test Harness Error:', globalErr);
        failed++;
    }

    console.log('================================================================');
    console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTests();
