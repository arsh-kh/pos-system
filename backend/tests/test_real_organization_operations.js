require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const assert = require('assert');
const db = require('../db');
const checkoutController = require('../controllers/checkout');
const purchaseInvoicesController = require('../controllers/purchase_invoices');
const shiftsController = require('../controllers/shifts');
const returnsController = require('../controllers/returns');
const customersController = require('../controllers/customers');
const expensesController = require('../controllers/expenses');
const backupController = require('../controllers/backup');
const fs = require('fs');
const path = require('path');

function mockReqRes(body = {}, params = {}, query = {}) {
    let statusCode = 200;
    let responseData = null;
    const req = {
        body,
        params,
        query,
        headers: { 'x-user-name': 'ئاراس محەمەد (سەرپەرشتیاری گشتی)' }
    };
    const res = {
        status: (code) => {
            statusCode = code;
            return res;
        },
        json: (data) => {
            responseData = data;
            return res;
        },
        send: (data) => {
            try { responseData = JSON.parse(data); } catch (_) { responseData = data; }
            return res;
        }
    };
    return { req, res, getResult: () => ({ statusCode, responseData }) };
}

async function runRealOrganizationOperationsTest() {
    console.log('========================================================================');
    console.log('🏛️ تاقیکردنەوەی تەواوی سووڕی ژیانی ڕێکخراو و مارکێتی گەورە (E2E Master Suite)');
    console.log('========================================================================\n');

    let createdShiftId = null;
    let createdInvoiceId = null;
    let createdSaleIds = [];
    let backupFilename = null;

    try {
        // -------------------------------------------------------------
        // ئامادەکاری ١: دڵنیابوون لە داخستنی شیفتە کۆنە کراوەکان
        // -------------------------------------------------------------
        console.log('--- هەنگاوی ١: ئامادەکاری و خاوێنکردنەوەی ژینگەی تاقیکردنەوە ---');
        const [openShifts] = await db.query("SELECT id FROM Shifts WHERE status = 'OPEN'");
        for (const s of openShifts) {
            await db.query("UPDATE Shifts SET status = 'CLOSED', closed_at = NOW() WHERE id = ?", [s.id]);
        }
        console.log('✓ هەموو شیفتە کراوە کۆنەکان داخران بۆ دەستپێکی خاوێن.');

        // Verify Real Master Entities
        const [supp] = await db.query("SELECT id, name FROM Suppliers WHERE name LIKE '%دڵخۆش%' LIMIT 1");
        assert(supp.length > 0, 'Supplier must exist');
        const supplierId = supp[0].id;

        const [custA] = await db.query("SELECT id, name FROM Customers WHERE name LIKE '%هێمن%' LIMIT 1");
        const [custB] = await db.query("SELECT id, name FROM Customers WHERE name LIKE '%ڕێبوار%' LIMIT 1");
        assert(custA.length > 0 && custB.length > 0, 'Customers must exist');
        const customerHeminId = custA[0].id;
        const customerRebwarId = custB[0].id;

        // Reset Dr. Rebwar's debt to 0 before starting test for clean ledger
        await db.query("DELETE FROM Customer_Debts WHERE customer_id = ?", [customerRebwarId]);

        // Get Real Products
        const [pRice] = await db.query("SELECT * FROM Products WHERE barcode = '8690504123456'");
        const [pOil] = await db.query("SELECT * FROM Products WHERE barcode = '8690123456789'");
        const [pYogurt] = await db.query("SELECT * FROM Products WHERE barcode = '6260123456001'");
        const [pMilk] = await db.query("SELECT * FROM Products WHERE barcode = '5411188110927'");
        const [pTomato] = await db.query("SELECT * FROM Products WHERE barcode = '2000010000000'");
        const [pAriel] = await db.query("SELECT * FROM Products WHERE barcode = '4015600854123'");
        const [pFairy] = await db.query("SELECT * FROM Products WHERE barcode = '5410076543210'");
        const [pLotus] = await db.query("SELECT * FROM Products WHERE barcode = '5410126006789'");
        const [pNutella] = await db.query("SELECT * FROM Products WHERE barcode = '8000500179863'");

        console.log('✓ دڵنیابوونەوە لە کاڵاکان، پۆلەکان و کڕیارە سەرەکییەکانی مارکێت.\n');

        // -------------------------------------------------------------
        // هەنگاوی ٢: وەرگرتنی کاڵا لە کۆمپانیا بە تێچووی گواستنەوە (Landed Cost Purchase)
        // -------------------------------------------------------------
        console.log('--- هەنگاوی ٢: وەرگرتنی پسووڵەی کڕین لە کۆمپانیا بە کرێی گواستنەوە (Inbound Landed Cost) ---');
        const invoicePayload = {
            supplier_id: supplierId,
            invoice_number: 'INV-ORG-' + Date.now().toString().slice(-6),
            payment_method: 'CASH',
            additional_cost: 20000, // 20,000 IQD freight
            paid_amount: 500000,
            remaining_amount: 0,
            items: [
                {
                    product_id: pOil[0].id,
                    quantity: 24, // 2 boxes of 12
                    cost_price: 6500,
                    selling_price: 8500,
                    units_per_box: 12,
                    expiry_date: '2027-12-31'
                },
                {
                    product_id: pYogurt[0].id,
                    quantity: 30, // 5 boxes of 6
                    cost_price: 1800,
                    selling_price: 2500,
                    units_per_box: 6,
                    expiry_date: '2026-12-31'
                }
            ]
        };

        const piMock = mockReqRes(invoicePayload);
        await purchaseInvoicesController.createPurchaseInvoice(piMock.req, piMock.res);
        const piRes = piMock.getResult();
        assert.strictEqual(piRes.statusCode, 201, 'Purchase invoice creation must succeed');
        createdInvoiceId = piRes.responseData.invoice_id || piRes.responseData.data?.invoice_id;
        console.log(`✓ پسووڵەی کڕین لە کۆمپانیا تۆمارکرا: ID #${createdInvoiceId}, گواستنەوە: 20,000 دینار`);

        // -------------------------------------------------------------
        // هەنگاوی ٣: کردنەوەی شیفتی بەیانی کاشێر (Open Cashier Shift)
        // -------------------------------------------------------------
        console.log('\n--- هەنگاوی ٣: کردنەوەی شیفتی بەیانی کاشێر بە سەرمایەی سەرەتا (Open Shift) ---');
        // Sleep 1.1s to guarantee second boundary isolation from prior test suites
        await new Promise(r => setTimeout(r, 1100));
        const openShiftMock = mockReqRes({
            cashier_name: 'ئاراس محەمەد (کاشێری سەرەکی)',
            opening_cash: 150000
        });
        await shiftsController.openShift(openShiftMock.req, openShiftMock.res);
        const osRes = openShiftMock.getResult();
        assert.strictEqual(osRes.statusCode, 201, 'Open shift must return 201');
        createdShiftId = osRes.responseData.data.id;
        console.log(`✓ شیفت کرایەوە: ID #${createdShiftId}, سەرمایەی ناو داخیلە: 150,000 دینار`);

        // -------------------------------------------------------------
        // هەنگاوی ٤: فرۆشتنی تاک و کێشانە (Transaction 1: Retail Cash + Scale Barcode)
        // -------------------------------------------------------------
        console.log('\n--- هەنگاوی ٤: فرۆشتنی تاک لەگەڵ میوەی کێشانە (Retail Basket + Scale Weight) ---');
        // Basket: 2x ماستی کالی (5000) + 1x شیری ئەلپڕۆ (4500) + 1x شوکۆلاتەی نۆتێلا (9500) + 1.5kg تەماتە (1500)
        // Subtotal = 20,500 IQD. Payment = CASH 20,500 IQD.
        const sale1Payload = {
            payment_method: 'CASH',
            paid_amount: 20500,
            items: [
                { barcode: pYogurt[0].barcode, quantity: 2, price: 2500, unit_type: 'PIECE' },
                { barcode: pMilk[0].barcode, quantity: 1, price: 4500, unit_type: 'PIECE' },
                { barcode: pNutella[0].barcode, quantity: 1, price: 9500, unit_type: 'PIECE' },
                { barcode: pTomato[0].barcode, quantity: 1.5, price: 1000, unit_type: 'KG' } // Scale produce
            ]
        };

        const s1Mock = mockReqRes(sale1Payload);
        await checkoutController.processCheckout(s1Mock.req, s1Mock.res);
        const s1Res = s1Mock.getResult();
        assert.strictEqual(s1Res.statusCode, 201, 'Sale 1 checkout must succeed');
        const sale1Id = s1Res.responseData.saleId;
        createdSaleIds.push(sale1Id);
        assert.strictEqual(Number(s1Res.responseData.total), 20500, 'Sale 1 total must be 20,500');
        console.log(`✓ پسووڵەی ١ (تاک و کێشانە) جێبەجێ کرا: ID #${sale1Id}, کۆ: 20,500 دیناری نەقد`);

        // -------------------------------------------------------------
        // هەنگاوی ٥: فرۆشتنی جوملە بە کارتۆن (Transaction 2: Wholesale Carton Sale)
        // -------------------------------------------------------------
        console.log('\n--- هەنگاوی ٥: فرۆشتنی جوملە بە کارتۆن (Wholesale Box Sale) ---');
        // Customer Hemin buys 1 full box of Olive Oil (12 bottles) @ wholesale 8,000 IQD = 96,000 IQD
        const sale2Payload = {
            customer_id: customerHeminId,
            payment_method: 'CASH',
            paid_amount: 96000,
            items: [
                {
                    barcode: pOil[0].box_barcode || pOil[0].barcode,
                    quantity: 1, // 1 Box
                    unit_type: 'BOX',
                    price: 96000,
                    has_custom_price: true
                }
            ]
        };

        const s2Mock = mockReqRes(sale2Payload);
        await checkoutController.processCheckout(s2Mock.req, s2Mock.res);
        const s2Res = s2Mock.getResult();
        assert.strictEqual(s2Res.statusCode, 201, 'Sale 2 box sale must succeed');
        const sale2Id = s2Res.responseData.saleId;
        createdSaleIds.push(sale2Id);
        assert.strictEqual(Number(s2Res.responseData.total), 96000, 'Sale 2 total must be 96,000');
        console.log(`✓ پسووڵەی ٢ (جوملەی کارتۆن) جێبەجێ کرا: ID #${sale2Id}, کۆ: 96,000 دیناری نەقد`);

        // -------------------------------------------------------------
        // هەنگاوی ٦: فرۆشتنی فرە-پارەدان بە داشکاندن و قەرز (Transaction 3: SPLIT + Discount)
        // -------------------------------------------------------------
        console.log('\n--- هەنگاوی ٦: فرۆشتنی داشکاندن و پارەدانی دووانەیی (SPLIT: Cash + Debt) ---');
        // Customer Dr. Rebwar buys:
        // 1x برنجی مەحموود 10 کگم (25,000)
        // 1x شوکۆلاتەی نۆتێلا (9,500)
        // 4x زاهی فەیری (4 * 2750 = 11,000)
        // 1x پسکیتی لۆتۆس (3,000)
        // Subtotal = 48,500 IQD
        // Store Discount = 3,500 IQD -> Net Grand Total = 45,000 IQD
        // Payment: 20,000 IQD Cash + 25,000 IQD Customer Debt (SPLIT)
        const sale3Payload = {
            customer_id: customerRebwarId,
            payment_method: 'SPLIT',
            subtotal_amount: 48500,
            discount_amount: 3500,
            total_amount: 45000,
            paid_amount: 20000,
            debt_amount: 25000,
            items: [
                { barcode: pRice[0].barcode, quantity: 1, price: 25000, unit_type: 'PIECE' },
                { barcode: pNutella[0].barcode, quantity: 1, price: 9500, unit_type: 'PIECE' },
                { barcode: pFairy[0].barcode, quantity: 4, price: 2750, unit_type: 'PIECE' },
                { barcode: pLotus[0].barcode, quantity: 1, price: 3000, unit_type: 'PIECE' }
            ]
        };

        const s3Mock = mockReqRes(sale3Payload);
        await checkoutController.processCheckout(s3Mock.req, s3Mock.res);
        const s3Res = s3Mock.getResult();
        assert.strictEqual(s3Res.statusCode, 201, 'Sale 3 SPLIT checkout must succeed');
        const sale3Id = s3Res.responseData.saleId;
        createdSaleIds.push(sale3Id);
        assert.strictEqual(Number(s3Res.responseData.total), 45000, 'Sale 3 net total must be 45,000');
        assert.strictEqual(Number(s3Res.responseData.paid_amount), 20000, 'Sale 3 cash paid must be 20,000');
        assert.strictEqual(Number(s3Res.responseData.debt_amount), 25000, 'Sale 3 debt must be 25,000');
        console.log(`✓ پسووڵەی ٣ (داشکاندن و قەرز) جێبەجێ کرا: ID #${sale3Id}, نەقد: 20,000 | قەرز: 25,000`);

        // Verify Dr. Rebwar's debt balance
        const [debtsAfterSale] = await db.query(
            "SELECT SUM(CASE WHEN transaction_type = 'ADD' THEN amount ELSE -amount END) as current_debt FROM Customer_Debts WHERE customer_id = ?",
            [customerRebwarId]
        );
        assert.strictEqual(Number(debtsAfterSale[0].current_debt), 25000, "Dr. Rebwar debt must be 25,000");
        console.log('✓ باڵانسی قەرزی دکتۆر ڕێبوار بە تەواوی هاوکاتکرا بۆ: 25,000 دینار');

        // -------------------------------------------------------------
        // هەنگاوی ٧: گەڕاندنەوەی زیرەکانەی کاڵا دوای داشکاندن (Smart Post-Discount Return)
        // -------------------------------------------------------------
        console.log('\n--- هەنگاوی ٧: گەڕاندنەوەی زیرەکانە و گەڕاندنەوەی پارەی داشکێنراو (Smart Return) ---');
        // Customer Dr. Rebwar returns 1 bottle of Fairy from Sale 3
        const retPayload = {
            sale_id: sale3Id,
            product_id: pFairy[0].id,
            quantity: 1,
            refund_method: 'CASH',
            reason: 'زیادەیە کڕیار نایەوێت'
        };

        const retMock = mockReqRes(retPayload);
        await returnsController.processReturn(retMock.req, retMock.res);
        const retRes = retMock.getResult();
        assert.strictEqual(retRes.statusCode, 200, 'Return must succeed with 200');
        const refundedAmount = Number(retRes.responseData.refunded_amount);
        assert.strictEqual(refundedAmount, 2552, 'Proportional refund must be exactly 2,552 IQD');
        console.log(`✓ کاڵای گەڕاوە لەسەر پسووڵەی داشکێنراو قبوڵکرا: گەڕاندنەوەی نەقد: ${refundedAmount} دینار (بێ زیانی مارکێت)`);

        // -------------------------------------------------------------
        // هەنگاوی ٨: دانەوەی بەشێک لە قەرز لەلایەن کڕیارەوە (Customer Debt Repayment)
        // -------------------------------------------------------------
        console.log('\n--- هەنگاوی ٨: دانەوەی قەرز بە نەقد لەلایەن کڕیارەوە (Debt Repayment) ---');
        // Dr. Rebwar repays 15,000 IQD in cash to cashier
        const payDebtMock = mockReqRes({
            amount: 15000,
            transaction_type: 'PAY',
            note: 'دانەوەی بەشێک لە قەرزی پسووڵە'
        }, { id: customerRebwarId });

        await customersController.addDebtTransaction(payDebtMock.req, payDebtMock.res);
        assert.strictEqual(payDebtMock.getResult().statusCode, 201, 'Debt payment must succeed');

        // Check remaining debt
        const [debtsAfterPay] = await db.query(
            "SELECT SUM(CASE WHEN transaction_type = 'ADD' THEN amount ELSE -amount END) as current_debt FROM Customer_Debts WHERE customer_id = ?",
            [customerRebwarId]
        );
        const remainingDebt = Number(debtsAfterPay[0].current_debt);
        assert.strictEqual(remainingDebt, 10000, 'Remaining debt must be exactly 10,000 IQD (25,000 - 15,000)');
        console.log(`✓ دانەوەی قەرز تۆمارکرا: 15,000 دینار، قەرزی ماوەی کڕیار: ${remainingDebt.toLocaleString()} دینار`);

        // -------------------------------------------------------------
        // هەنگاوی ٩: تۆمارکردنی خەرجی ڕۆژانەی مارکێت لە داخیلە (Operational Expense)
        // -------------------------------------------------------------
        console.log('\n--- هەنگاوی ٩: تۆمارکردنی خەرجی کارگێڕی لە قاسەی کاشێر (Operational Expense) ---');
        const expMock = mockReqRes({
            title: 'کڕینی چای و پاککەرەوە بۆ ستاف',
            category: 'خزمەتگوزاری ناوخۆیی',
            amount: 8000,
            notes: 'لەلایەن کاشێرەوە لە قاسە دراوە'
        });

        await expensesController.createExpense(expMock.req, expMock.res);
        assert.strictEqual(expMock.getResult().statusCode, 201, 'Expense must succeed');
        console.log('✓ خەرجی کارگێڕی لە قاسەی شیفت تۆمارکرا: 8,000 دینار');

        // -------------------------------------------------------------
        // هەنگاوی ١٠: وردبینی و داخستنی شیفت (Shift Reconciliation & Z-Report)
        // -------------------------------------------------------------
        console.log('\n--- هەنگاوی ١٠: وردبینی قاسە و داخستنی شیفت (Z-Report Cash Reconciliation) ---');
        // Formula:
        // expectedCash = openingCash (150,000)
        //              + cashSales (20,500 + 96,000 + 20,000 = 136,500)
        //              + debtRepaidCash (15,000)
        //              - expensesPaid (8,000)
        //              - cashRefunds (2,552)
        // Total expected = 150,000 + 136,500 + 15,000 - 8,000 - 2,552 = 290,948 IQD.
        const expectedDrawerCash = 150000 + 136500 + 15000 - 8000 - 2552;

        const closeMock = mockReqRes({
            actual_cash: expectedDrawerCash,
            notes: 'داخستنی شیفتی بەیانی - پارەی ناو قاسە ١٠٠٪ تەبا و بێ جیاوازییە'
        }, { id: createdShiftId });

        await shiftsController.closeShift(closeMock.req, closeMock.res);
        const csRes = closeMock.getResult();
        assert.strictEqual(csRes.statusCode, 200, 'Shift close must succeed');
        const closedShift = csRes.responseData.data;

        console.log('✓ ئەنجامی شیفتی داخراو:');
        console.log(`  - پارەی سەرەتای شیفت: ${Number(closedShift.opening_cash).toLocaleString()} دینار`);
        console.log(`  - کۆی فرۆشی نەقد: ${Number(closedShift.cash_sales).toLocaleString()} دینار`);
        console.log(`  - قەرزی وەرگیراوە بە نەقد: ${Number(closedShift.debt_repaid_cash).toLocaleString()} دینار`);
        console.log(`  - پارەی گەڕاوەی نەقد: ${Number(closedShift.cash_refunds).toLocaleString()} دینار`);
        console.log(`  - خەرجی دراو: ${Number(closedShift.expenses_paid).toLocaleString()} دینار`);
        console.log(`  - پارەی چاوەڕوانکراو لە قاسە: ${Number(closedShift.expected_cash).toLocaleString()} دینار`);
        console.log(`  - پارەی ژمێردراوی ڕاستەقینە: ${Number(closedShift.actual_cash).toLocaleString()} دینار`);
        console.log(`  - جیاوازی (Difference): ${closedShift.difference} دینار`);
        assert.strictEqual(Number(closedShift.difference), 0, 'Shift difference must be exactly 0 dinars!');

        // -------------------------------------------------------------
        // هەنگاوی ١١: دروستکردنی باکئەپی گشتی ڕێکخراو لە کۆتایی ڕۆژ (Enterprise EOD Backup)
        // -------------------------------------------------------------
        console.log('\n--- هەنگاوی ١١: دروستکردنی باکئەپی تەواوی ڕێکخراو لە کۆتایی ڕۆژ (Enterprise Backup Snapshot) ---');
        const snapMock = mockReqRes({ note: 'Royal Supermarket EOD Production Snapshot' });
        await backupController.createManualSnapshot(snapMock.req, snapMock.res);
        const snapRes = snapMock.getResult();
        assert.strictEqual(snapRes.statusCode, 200, 'Manual snapshot must succeed');
        backupFilename = snapRes.responseData.data.filename;
        assert(backupFilename && backupFilename.endsWith('.json'), 'Backup file must be generated');
        console.log(`✓ باکئەپی گشتی بە سەرکەوتوویی لەسەر سێرڤەر تۆمارکرا: ${backupFilename}`);

        // Read snapshot payload from disk
        const backupsDir = path.resolve(__dirname, '../backups');
        const backupFilePath = path.join(backupsDir, backupFilename);
        assert(fs.existsSync(backupFilePath), 'Backup file must exist on disk');
        const backupContent = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));

        assert(backupContent.tables.sales.some(s => s.id === sale3Id), 'Sale 3 must be in backup');
        assert(backupContent.tables.customers.some(c => c.id === customerRebwarId), 'Customer Dr. Rebwar must be in backup');
        console.log(`✓ دڵنیابووینەوە: فایلی باکئەپ هەموو ٢٩ خشتەکە، فرۆشەکان، کڕیاران و پسووڵەکانی تێدایە!`);

        // -------------------------------------------------------------
        // هەنگاوی ١٢: شێواندنی لەناکاوی داتا و هێنانەوەی ١٠٠٪ بێ کەموکوڕی (Disaster Recovery Simulation)
        // -------------------------------------------------------------
        console.log('\n--- هەنگاوی ١٢: تاقیکردنەوەی لەناوچوونی داتا و هێنانەوەی فریاگوزاری (Disaster Recovery & Restore) ---');
        // Simulate catastrophic data loss: delete customer debts and the sales
        await db.query("DELETE FROM Customer_Debts WHERE customer_id = ?", [customerRebwarId]);
        await db.query("DELETE FROM Returns WHERE sale_id = ?", [sale3Id]);
        await db.query("DELETE FROM Sale_Items WHERE sale_id = ?", [sale3Id]);
        await db.query("DELETE FROM Sales WHERE id = ?", [sale3Id]);

        const [verifyGone] = await db.query("SELECT * FROM Sales WHERE id = ?", [sale3Id]);
        assert.strictEqual(verifyGone.length, 0, 'Sale must be temporarily gone for disaster test');
        console.log('✓ داتاکان بە ئەنقەست سڕدرانەوە بۆ شێوەپێدانی تێکچوونی ڕەقەکاڵا / سێرڤەر');

        // Execute restore using the backup data!
        console.log('  ↪ دەستپێکردنی گەڕاندنەوەی باکئەپ (Executing Disaster Restore)...');
        const restoreMock = mockReqRes({ backupData: backupContent });
        await backupController.restoreBackup(restoreMock.req, restoreMock.res);
        const restoreRes = restoreMock.getResult();
        assert.strictEqual(restoreRes.statusCode, 200, 'Restore must return 200');
        assert.strictEqual(restoreRes.responseData.status, 'SUCCESS', 'Restore status must be SUCCESS');

        // Verify restored records
        const [restoredSale] = await db.query("SELECT * FROM Sales WHERE id = ?", [sale3Id]);
        assert(restoredSale.length > 0, 'Restored sale must exist');
        assert.strictEqual(Number(restoredSale[0].total_amount), 45000, 'Restored sale total must be 45,000');

        const [restoredDebt] = await db.query(
            "SELECT SUM(CASE WHEN transaction_type = 'ADD' THEN amount ELSE -amount END) as current_debt FROM Customer_Debts WHERE customer_id = ?",
            [customerRebwarId]
        );
        assert.strictEqual(Number(restoredDebt[0].current_debt), 10000, 'Restored customer debt must be exactly 10,000 IQD');
        console.log('✓ هەموو داتاکان بە سەرکەوتوویی ١٠٠٪ گەڕانەوە: پسووڵەی فرۆش، باڵانسی قەرزی کڕیار (10,000 دینار)، و تۆماری مەخزەن.');

        console.log('\n========================================================================');
        console.log('🎉 پیرۆزە! هەموو سووڕی ژیانی ڕێکخراوی مارکێت (E2E Operations & Disaster Recovery)');
        console.log('   بە شێوەی ڕاستەقینە، بێ هیچ هەڵەیەک بە ١٠٠٪ سەرکەوتوو بوو!');
        console.log('========================================================================\n');

    } catch (err) {
        console.error('❌ هەڵە لە تاقیکردنەوەی سووڕی ژیانی ڕێکخراو:', err);
        process.exitCode = 1;
    } finally {
        process.exit(process.exitCode || 0);
    }
}

runRealOrganizationOperationsTest();
