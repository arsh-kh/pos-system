require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');
const checkoutController = require('../controllers/checkout');
const purchaseInvoicesController = require('../controllers/purchase_invoices');
const productsController = require('../controllers/products');

function mockReqRes(body = {}, params = {}) {
    let statusCode = 200;
    let responseData = null;
    const req = { body, params, headers: { 'x-user-name': 'تەستەری FIFO' } };
    const res = {
        status: (code) => {
            statusCode = code;
            return res;
        },
        json: (data) => {
            responseData = data;
            return res;
        }
    };
    return { req, res, getResult: () => ({ statusCode, responseData }) };
}

async function runFifoTests() {
    console.log('=== دەستپێکردنی تاقیکردنەوەی سیستەمی قازانجی ورد بە FIFO ===');
    let testProductId = null;
    let testSupplierId = null;
    let sale1Id = null;
    let sale2Id = null;
    const testBarcode = 'OIL_TEST_' + Date.now();

    try {
        // 1. Create a test supplier
        const [supRes] = await db.query(
            "INSERT INTO Suppliers (name, phone, total_paid, total_remaining) VALUES ('کۆمپانیای زەیتی شاهانە', '07709999999', 0, 0)"
        );
        testSupplierId = supRes.insertId;
        console.log(`✓ کۆمپانیای دابینکەر دروستکرا: ID #${testSupplierId}`);

        // 2. Create test product: "زەیتی گوڵەبەڕۆژە", selling_price = 25000, initial stock = 0
        const [prodRes] = await db.query(
            "INSERT INTO Products (name, barcode, cost_price, selling_price, stock) VALUES ('زەیتی گوڵەبەڕۆژە', ?, 20000, 25000, 0)",
            [testBarcode]
        );
        testProductId = prodRes.insertId;
        console.log(`✓ کاڵای تاقیکاری زەیت دروستکرا: ID #${testProductId}, بارکۆد: ${testBarcode}`);

        // 3. Purchase 1: Last week's shipment - 10 bottles @ 20,000 IQD
        const p1Mock = mockReqRes({
            supplier_id: testSupplierId,
            paid_amount: 200000,
            remaining_amount: 0,
            invoice_number: 'INV-WEEK-1',
            invoice_date: '2026-10-01',
            items: [
                {
                    product_id: testProductId,
                    quantity: 10,
                    cost_price: 20000,
                    selling_price: 25000,
                    batch_number: 'BATCH-OIL-WEEK1'
                }
            ]
        });
        await purchaseInvoicesController.createPurchaseInvoice(p1Mock.req, p1Mock.res);
        const p1Res = p1Mock.getResult();
        if (p1Res.statusCode !== 201) {
            throw new Error(`شکستی کڕینی یەکەم: ${JSON.stringify(p1Res.responseData)}`);
        }
        console.log('✓ پسووڵەی کڕینی یەکەم تۆمارکرا (١٠ دانە بە ٢٠،٠٠٠ د.ع)');

        // 4. Purchase 2: This week's shipment - 10 bottles @ 22,000 IQD
        const p2Mock = mockReqRes({
            supplier_id: testSupplierId,
            paid_amount: 220000,
            remaining_amount: 0,
            invoice_number: 'INV-WEEK-2',
            invoice_date: '2026-10-08',
            items: [
                {
                    product_id: testProductId,
                    quantity: 10,
                    cost_price: 22000,
                    selling_price: 25000,
                    batch_number: 'BATCH-OIL-WEEK2'
                }
            ]
        });
        await purchaseInvoicesController.createPurchaseInvoice(p2Mock.req, p2Mock.res);
        const p2Res = p2Mock.getResult();
        if (p2Res.statusCode !== 201) {
            throw new Error(`شکستی کڕینی دووەم: ${JSON.stringify(p2Res.responseData)}`);
        }
        console.log('✓ پسووڵەی کڕینی دووەم تۆمارکرا (١٠ دانە بە ٢٢،٠٠٠ د.ع)');

        // Verify batches in database
        const [batchesBeforeSale] = await db.query(
            'SELECT * FROM Product_Batches WHERE product_id = ? ORDER BY created_at ASC, id ASC',
            [testProductId]
        );
        console.log(`✓ ژمارەی وەجبە چالاکەکان: ${batchesBeforeSale.length} وەجبە`);
        if (batchesBeforeSale.length !== 2) {
            throw new Error(`پێویستە ٢ وەجبە هەبێت بەڵام ${batchesBeforeSale.length} وەجبە هەیە`);
        }

        // 5. Checkout Sale 1: Sell 15 bottles @ 25,000 IQD
        // Expected FIFO math:
        // 10 units from Batch 1 @ 20,000 = 200,000 IQD
        //  5 units from Batch 2 @ 22,000 = 110,000 IQD
        // Total COGS = 310,000 IQD
        // Revenue = 15 * 25,000 = 375,000 IQD
        // Net Real Profit = 375,000 - 310,000 = 65,000 IQD!
        console.log('\n--- فرۆشتنی ١٥ دانە بە نرخی فرۆشتنی ٢٥،٠٠٠ د.ع بە سیستەمی FIFO ---');
        const sale1Mock = mockReqRes({
            items: [
                {
                    barcode: testBarcode,
                    quantity: 15,
                    price: 25000,
                    unit_type: 'PIECE'
                }
            ],
            payment_method: 'CASH',
            paid_amount: 375000,
            discount_amount: 0
        });
        await checkoutController.processCheckout(sale1Mock.req, sale1Mock.res);
        const sale1Res = sale1Mock.getResult();
        if (sale1Res.statusCode !== 201) {
            throw new Error(`شکستی فرۆشتن: ${JSON.stringify(sale1Res.responseData)}`);
        }
        sale1Id = sale1Res.responseData.saleId;
        console.log(`✓ فرۆشتن سەرکەوتوو بوو، ژمارەی پسووڵە: #${sale1Id}`);

        // Verify Sale 1 in database
        const [saleRecord] = await db.query('SELECT * FROM Sales WHERE id = ?', [sale1Id]);
        const actualTotalAmount = Number(saleRecord[0].total_amount);
        const actualTotalProfit = Number(saleRecord[0].total_profit);

        console.log(`- داهاتی فرۆش: ${actualTotalAmount.toLocaleString()} د.ع (چاوەڕوانکراو: 375,000)`);
        console.log(`- قازانجی تۆمارکراو: ${actualTotalProfit.toLocaleString()} د.ع (چاوەڕوانکراو: 65,000)`);

        if (actualTotalAmount !== 375000) {
            throw new Error(`داهاتی فرۆش هەڵەیە: ${actualTotalAmount} لەجیاتی 375000`);
        }
        if (actualTotalProfit !== 65000) {
            throw new Error(`قازانجی FIFO هەڵەیە: ${actualTotalProfit} لەجیاتی 65000 (ئەگەر کۆنەکە بوایە 45000 دەردەچوو!)`);
        }
        console.log('🌟 ئەنجامی حیساباتی قازانجی FIFO تەواو دروستە و بە سەرکەوتوویی سەلمێندرا!');

        // Verify batches state after Sale 1
        const [batchesAfterSale1] = await db.query(
            'SELECT * FROM Product_Batches WHERE product_id = ? ORDER BY created_at ASC, id ASC',
            [testProductId]
        );
        const b1 = batchesAfterSale1[0];
        const b2 = batchesAfterSale1[1];
        console.log(`- دۆخی وەجبەی ١ (کۆنتر): ماوە=${b1.remaining_quantity}, دۆخ=${b1.status}`);
        console.log(`- دۆخی وەجبەی ٢ (نوێتر): ماوە=${b2.remaining_quantity}, دۆخ=${b2.status}`);

        if (Number(b1.remaining_quantity) !== 0 || b1.status !== 'EXHAUSTED') {
            throw new Error('وەجبەی ١ دەبوو بە تەواوی تەواو ببێت (0 ماوە و EXHAUSTED)');
        }
        if (Number(b2.remaining_quantity) !== 5 || b2.status !== 'ACTIVE') {
            throw new Error('وەجبەی ٢ دەبوو 5 دانەی مابێتەوە و ACTIVE بێت');
        }

        // Verify Sale_Item_Batches
        const [allocations] = await db.query(
            'SELECT * FROM Sale_Item_Batches WHERE sale_id = ? ORDER BY id ASC',
            [sale1Id]
        );
        console.log(`✓ تۆماری خشتەی Sale_Item_Batches بۆ پسووڵە: ${allocations.length} دانە`);
        if (allocations.length !== 2) {
            throw new Error(`دەبوو ٢ وەجبە بەشدار بن بەڵام ${allocations.length} بەشدار بووە`);
        }
        console.log(`  - بەشی وەجبەی ١: ${allocations[0].quantity_deducted} دانە بە تێچوونی ${allocations[0].unit_cost_price} د.ع = ${allocations[0].total_cost} د.ع`);
        console.log(`  - بەشی وەجبەی ٢: ${allocations[1].quantity_deducted} دانە بە تێچوونی ${allocations[1].unit_cost_price} د.ع = ${allocations[1].total_cost} د.ع`);

        // 6. Verify Sale Details API
        const detailsMock = mockReqRes({}, { id: sale1Id });
        await checkoutController.getSaleDetails(detailsMock.req, detailsMock.res);
        const detailsData = detailsMock.getResult().responseData.data;
        if (!detailsData.items[0].batches || detailsData.items[0].batches.length !== 2) {
            throw new Error('وردەکاری پسووڵە خاوەنی ٢ وەجبە نییە');
        }
        console.log('✓ APIی وردەکاری پسووڵە (getSaleDetails) وردەکاری هەردوو وەجبەی گەڕاندەوە');

        // 7. Verify Product Batches API
        const prodBatchesMock = mockReqRes({}, { id: testProductId });
        await productsController.getProductBatches(prodBatchesMock.req, prodBatchesMock.res);
        const prodBatchesData = prodBatchesMock.getResult().responseData.data;
        if (prodBatchesData.length !== 2) {
            throw new Error('APIی وەجبەکانی کاڵا هەر ٢ وەجبەی نەگەڕاندەوە');
        }
        console.log('✓ APIی getProductBatches بە سەرکەوتوویی وەجبەکان و دابینکەری گەڕاندەوە');

        // 8. Sale 2: Sell remaining 5 bottles
        console.log('\n--- فرۆشتنی ٥ دانەی کۆتایی ماوە لە وەجبەی دووەم ---');
        const sale2Mock = mockReqRes({
            items: [{ barcode: testBarcode, quantity: 5, price: 25000, unit_type: 'PIECE' }],
            payment_method: 'CASH',
            paid_amount: 125000,
            discount_amount: 0
        });
        await checkoutController.processCheckout(sale2Mock.req, sale2Mock.res);
        sale2Id = sale2Mock.getResult().responseData.saleId;

        const [sale2Record] = await db.query('SELECT * FROM Sales WHERE id = ?', [sale2Id]);
        const s2Profit = Number(sale2Record[0].total_profit);
        console.log(`- قازانجی فرۆشی دووەم: ${s2Profit.toLocaleString()} د.ع (چاوەڕوانکراو: 15,000 د.ع: 125,000 - 110,000)`);
        if (s2Profit !== 15000) {
            throw new Error(`قازانجی فرۆشی دووەم هەڵەیە: ${s2Profit}`);
        }

        const [finalProd] = await db.query('SELECT stock FROM Products WHERE id = ?', [testProductId]);
        console.log(`✓ مەخزەنی کۆتایی کاڵا: ${finalProd[0].stock} دانە`);
        if (Number(finalProd[0].stock) !== 0) {
            throw new Error('مەخزەن دەبوو سفر بێت');
        }

        console.log('\n======================================================');
        console.log('🎉 هەموو تاقیکردنەوەکانی سیستەمی قازانجی FIFO ١٠٠٪ سەرکەوتوون!');
        console.log('======================================================');

    } catch (err) {
        console.error('❌ هەڵە لە تاقیکردنەوەی FIFO:', err);
        process.exitCode = 1;
    } finally {
        // Cleanup test data
        try {
            if (testProductId) {
                await db.query('DELETE FROM Sale_Item_Batches WHERE batch_id IN (SELECT id FROM Product_Batches WHERE product_id = ?)', [testProductId]);
                await db.query('DELETE FROM Sale_Items WHERE product_id = ?', [testProductId]);
                await db.query('DELETE FROM Product_Batches WHERE product_id = ?', [testProductId]);
                await db.query('DELETE FROM Purchase_Invoice_Items WHERE product_id = ?', [testProductId]);
                await db.query('DELETE FROM Products WHERE id = ?', [testProductId]);
                console.log('✓ کاڵای تاقیکاری و وەجبەکانی پاککرانەوە');
            }
            if (sale1Id || sale2Id) {
                await db.query('DELETE FROM Sales WHERE id IN (?, ?)', [sale1Id || 0, sale2Id || 0]);
                console.log('✓ پسووڵەکانی تاقیکاری پاککرانەوە');
            }
            if (testSupplierId) {
                await db.query('DELETE FROM Purchase_Invoices WHERE supplier_id = ?', [testSupplierId]);
                await db.query('DELETE FROM Suppliers WHERE id = ?', [testSupplierId]);
                console.log('✓ دابینکەری تاقیکاری پاککرایەوە');
            }
        } catch (cleanupErr) {
            console.error('تێبینی پاککردنەوە:', cleanupErr.message);
        }
        process.exit(process.exitCode || 0);
    }
}

runFifoTests();
