/**
 * Comprehensive Financial Calculations, Debt Tracking, Discount Application,
 * and Post-Discount Returns Test Suite.
 * Mirrors all scenarios from Phase 2 of the Financial Logic Audit.
 */

const assert = require('assert');
const db = require('../db');
const checkoutController = require('../controllers/checkout');
const returnsController = require('../controllers/returns');
const customersController = require('../controllers/customers');

function createMockReqRes(body = {}, params = {}, query = {}) {
  let statusCode = 200;
  let responseData = null;

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
      responseData = data;
      return res;
    }
  };

  const req = {
    body,
    params,
    query,
    user: { id: 1, role: 'admin', username: 'auditor' },
    ip: '127.0.0.1'
  };

  return { req, res, getResult: () => ({ statusCode, responseData }) };
}

async function getCustomerTotalDebt(customerId) {
  const [rows] = await db.query(`
    SELECT COALESCE(SUM(CASE WHEN transaction_type = 'ADD' THEN amount ELSE -amount END), 0) AS total_debt
    FROM Customer_Debts
    WHERE customer_id = ?
  `, [customerId]);
  return Number(rows[0]?.total_debt || 0);
}

async function runFinancialAuditTests() {
  console.log('========================================================================');
  console.log('💰 دەستپێکردنی تاقیکردنەوەی گشتگیری حیساباتی دارایی و قەرز و گەڕاندنەوە');
  console.log('   (Comprehensive Financial Audit & Edge-Case Verification Suite)');
  console.log('========================================================================\n');

  let testCustomerId = null;
  let testProductId1 = null;
  let testProductId2 = null;
  const timestamp = Date.now();
  const barcode1 = `BAR_FIN_1_${timestamp}`;
  const barcode2 = `BAR_FIN_2_${timestamp}`;

  try {
    // -------------------------------------------------------------------------
    // Setup Test Data
    // -------------------------------------------------------------------------
    const [custRes] = await db.query(
      `INSERT INTO Customers (name, phone, notes) 
       VALUES ('کڕیاری وردبینی دارایی', '0750${Math.floor(1000000 + Math.random() * 9000000)}', 'تاقیکردنەوە')`
    );
    testCustomerId = custRes.insertId;

    const [prod1Res] = await db.query(
      `INSERT INTO Products (name, barcode, cost_price, selling_price, stock) 
       VALUES ('کاڵای وردبینی ١', ?, 5000, 10000, 100)`,
      [barcode1]
    );
    testProductId1 = prod1Res.insertId;

    const [prod2Res] = await db.query(
      `INSERT INTO Products (name, barcode, cost_price, selling_price, stock) 
       VALUES ('کاڵای وردبینی ٢', ?, 10000, 20000, 100)`,
      [barcode2]
    );
    testProductId2 = prod2Res.insertId;

    console.log(`✓ داتای سەرەتایی ئامادەکرا: کڕیار #${testCustomerId}, کاڵای ١ #${testProductId1}, کاڵای ٢ #${testProductId2}`);

    // =========================================================================
    // Scenario 1: Multiple Discounts & Line-Item Proportional Distribution
    // =========================================================================
    console.log('\n--- [Scenario 1] دابەشکردنی ڕێژەیی داشکاندن لەسەر کاڵاکان (Line-Item Distribution) ---');
    // Cart: 2x Item 1 (2 * 10,000 = 20,000) + 1x Item 2 (1 * 20,000 = 20,000). Total Subtotal = 40,000
    // Cart Discount = 10,000 IQD. Final Total = 30,000 IQD (25% discount across the whole cart)
    const { req: req1, res: res1, getResult: getRes1 } = createMockReqRes({
      customer_id: testCustomerId,
      items: [
        { barcode: barcode1, quantity: 2, price: 10000, unit: 'دانە', unit_type: 'PIECE' },
        { barcode: barcode2, quantity: 1, price: 20000, unit: 'دانە', unit_type: 'PIECE' }
      ],
      discount_amount: 10000,
      payment_method: 'CASH',
      paid_amount: 30000,
      user_id: 1
    });

    await checkoutController.processCheckout(req1, res1);
    const saleRes1 = getRes1();
    assert.strictEqual(saleRes1.statusCode, 201, 'Checkout 1 must succeed with 201');
    const saleId1 = saleRes1.responseData.saleId;

    // Verify Sale record in Database
    const [saleRecord1] = await db.query('SELECT total_amount, discount_amount, paid_amount, payment_method FROM Sales WHERE id = ?', [saleId1]);
    assert.strictEqual(Number(saleRecord1[0].total_amount), 30000, 'Sale total must be exactly 30,000 IQD');
    assert.strictEqual(Number(saleRecord1[0].discount_amount), 10000, 'Sale discount must be 10,000 IQD');
    assert.strictEqual(Number(saleRecord1[0].paid_amount), 30000, 'Paid amount must be 30,000 IQD');
    assert.strictEqual(saleRecord1[0].payment_method, 'CASH', 'Payment method must be CASH');

    console.log('✓ فرۆشتن بە سەرکەوتوویی تۆمارکرا بە کۆی ٣٠,٠٠٠ د.ع دوای داشکاندنی ١٠,٠٠٠ د.ع');

    // =========================================================================
    // Scenario 2: Partial Return with Proportional Discount Calculation
    // =========================================================================
    console.log('\n--- [Scenario 2] گەڕاندنەوەی بەشەکی بە داشکاندنی پێوانەیی (Post-Discount Return) ---');
    // Customer returns 1x Item 1. Original catalog price = 10,000 IQD.
    // Since 25% discount was applied to the entire cart (30,000 / 40,000 = 0.75),
    // 1x Item 1 was effectively purchased at 7,500 IQD. Refund must be exactly 7,500 IQD!
    const { req: retReq1, res: retRes1, getResult: getRetRes1 } = createMockReqRes({
      sale_id: saleId1,
      product_id: testProductId1,
      quantity: 1,
      reason: 'تاقیکردنەوەی گەڕاندنەوەی بەشەکی',
      refund_method: 'CASH'
    });

    await returnsController.processReturn(retReq1, retRes1);
    const retResult1 = getRetRes1();
    assert.strictEqual(retResult1.statusCode, 200, 'Partial return must succeed');
    assert.strictEqual(Number(retResult1.responseData.refunded_amount), 7500, 'Partial refund must be exactly 7,500 IQD (proportional)');

    console.log('✓ گەڕاندنەوەی بەشەکی بە دروستی ئەنجامدرا: ٧,٥٠٠ دینار گەڕێنرایەوە (نەک ١٠,٠٠٠ دیناری کەتەلۆگ)');

    // =========================================================================
    // Scenario 3: Debt & Split Payment Handling (Cash vs Debt Recording)
    // =========================================================================
    console.log('\n--- [Scenario 3] پارەدانی تێکەڵ (SPLIT: نەقد و قەرز) و تۆماری دەقاوودەق ---');
    // Sale total: 20,000 IQD. Customer pays 5,000 CASH, remaining 15,000 as DEBT.
    const { req: splitReq, res: splitRes, getResult: getSplitRes } = createMockReqRes({
      customer_id: testCustomerId,
      items: [
        { barcode: barcode2, quantity: 1, price: 20000, unit: 'دانە', unit_type: 'PIECE' }
      ],
      payment_method: 'SPLIT',
      paid_amount: 5000,
      user_id: 1
    });

    await checkoutController.processCheckout(splitReq, splitRes);
    const splitSaleRes = getSplitRes();
    assert.strictEqual(splitSaleRes.statusCode, 201, 'Split checkout must succeed');
    const splitSaleId = splitSaleRes.responseData.saleId;

    const debtAfterSplit = await getCustomerTotalDebt(testCustomerId);
    assert.strictEqual(debtAfterSplit, 15000, 'Customer debt balance must be updated by exactly 15,000 IQD');
    console.log('✓ باڵانسی قەرزی کڕیار بە دروستی زیادکرا بە ١٥,٠٠٠ دینار');

    // =========================================================================
    // Scenario 4: Overpayment Guard on SPLIT Checkout
    // =========================================================================
    console.log('\n--- [Scenario 4] پاراستنی سیستم لە پارەدانی زیادەڕۆ لە جۆری SPLIT ---');
    // Sale total: 10,000 IQD. If user passes paid_amount: 25,000 under SPLIT,
    // System must clamp paid_amount to 10,000 IQD and set remaining debt to 0 (no negative debt corruption).
    const { req: overReq, res: overRes, getResult: getOverRes } = createMockReqRes({
      customer_id: testCustomerId,
      items: [
        { barcode: barcode1, quantity: 1, price: 10000, unit: 'دانە', unit_type: 'PIECE' }
      ],
      payment_method: 'SPLIT',
      paid_amount: 25000,
      user_id: 1
    });

    await checkoutController.processCheckout(overReq, overRes);
    const overResOut = getOverRes();
    assert.strictEqual(overResOut.statusCode, 201, 'Clamped split checkout must succeed');
    const [overSaleRecord] = await db.query('SELECT total_amount, paid_amount FROM Sales WHERE id = ?', [overResOut.responseData.saleId]);
    assert.strictEqual(Number(overSaleRecord[0].paid_amount), 10000, 'Paid amount in SPLIT must be clamped to total_amount (10,000 IQD)');
    console.log('✓ بڕی پارەی زیادەڕۆ بە دروستی کڵامپ کرا بۆ تەواوی کۆی پسووڵەکە (١٠,٠٠٠ د.ع)');

    // =========================================================================
    // Scenario 5: Debt Repayment & Boundary Checking
    // =========================================================================
    console.log('\n--- [Scenario 5] دانەوەی قەرز و ڕێگریکردن لە ژمارەی نێگەتیڤ ---');
    // Customer debt is currently 15,000 IQD. Paying 10,000 IQD leaves 5,000 IQD.
    const { req: payReq1, res: payRes1, getResult: getPayRes1 } = createMockReqRes({
      amount: 10000,
      transaction_type: 'PAY',
      note: 'دانەوەی بەشێک لە قەرز'
    }, { id: testCustomerId });

    await customersController.addDebtTransaction(payReq1, payRes1);
    const debtAfterPay = await getCustomerTotalDebt(testCustomerId);
    assert.strictEqual(debtAfterPay, 5000, 'Remaining customer debt must be 5,000 IQD');
    console.log('✓ ١٠,٠٠٠ دینار لە قەرزەکە دایەوە، باڵانسی ماوە بە دروستی بووە ٥,٠٠٠ دینار');

    // Attempting to repay 0 or negative amount must be strictly rejected
    const { req: negPayReq, res: negPayRes, getResult: getNegPayRes } = createMockReqRes({
      amount: -5000,
      transaction_type: 'PAY'
    }, { id: testCustomerId });

    await customersController.addDebtTransaction(negPayReq, negPayRes);
    assert.strictEqual(getNegPayRes().statusCode, 400, 'Negative debt payment must be rejected with 400 Bad Request');
    console.log('✓ دانەوەی ژمارەی نێگەتیڤ بە سەرکەوتوویی ڕەتکرایەوە (HTTP 400)');

    // =========================================================================
    // Scenario 6: Financial Debt Protection Guard on Returns
    // =========================================================================
    console.log('\n--- [Scenario 6] پاراستنی سندوق: گەڕاندنەوەی کاڵای قەرزدار ---');
    // splitSaleId was 20,000 total: 5,000 cash paid, 15,000 on debt.
    // Customer asks for CASH refund on a 20,000 item where only 5,000 cash was paid.
    // Financial Debt Protection Guard must detect (refundedAmount > maxCashRefundable) and forcibly divert to DEBT!
    const { req: debtRetReq, res: debtRetRes, getResult: getDebtRetRes } = createMockReqRes({
      sale_id: splitSaleId,
      product_id: testProductId2,
      quantity: 1,
      refund_method: 'CASH', // Demands physical cash!
      reason: 'گەڕاندنەوەی کاڵای بە قەرز کڕدراو'
    });

    await returnsController.processReturn(debtRetReq, debtRetRes);
    const debtRetResult = getDebtRetRes();
    assert.strictEqual(debtRetResult.statusCode, 200, 'Debt-funded return must succeed');
    assert.strictEqual(debtRetResult.responseData.refund_method, 'DEBT', 'Refund method must be forcibly diverted to DEBT to protect physical cash');
    console.log(`✓ بەربەستی دارایی سندوقی پاراست: داواکاریی کاش گۆڕدرا بۆ DEBT چونکە کڕینەکە قەرزی تێدابوو (${debtRetResult.responseData.refunded_amount} د.ع)`);

    // =========================================================================
    // Scenario 7: Idempotency & Over-Return Rejection
    // =========================================================================
    console.log('\n--- [Scenario 7] پاراستنی سیستم لە دووبارەبوونەوە و گەڕاندنەوەی زیادەڕۆ (Idempotency) ---');
    // Sale 1 had 2x Item 1. 1 was already returned in Scenario 2.
    // If someone attempts to return 2 more of Item 1 from Sale 1, it must be rejected!
    const { req: dupRetReq, res: dupRetRes, getResult: getDupRetRes } = createMockReqRes({
      sale_id: saleId1,
      product_id: testProductId1,
      quantity: 2, // Only 1 remains!
      reason: 'هەوڵی گەڕاندنەوەی زیادەڕۆ',
      refund_method: 'CASH'
    });

    await returnsController.processReturn(dupRetReq, dupRetRes);
    const dupRes = getDupRetRes();
    assert.strictEqual(dupRes.statusCode, 500, 'Over-returning items must throw error (500/handled)');
    console.log('✓ هەوڵی گەڕاندنەوەی بڕی زیاتر لە فرۆشراو بە سەرکەوتوویی بلۆک کرا');

    console.log('\n========================================================================');
    console.log('🎉 پیرۆزە! هەموو تاقیکردنەوەکانی وردبینی دارایی و قەرز ١٠٠٪ سەرکەوتوون!');
    console.log('========================================================================\n');

  } finally {
    // Clean up test records
    try {
      if (testCustomerId) {
        await db.query('DELETE FROM Customer_Debts WHERE customer_id = ?', [testCustomerId]);
        await db.query('DELETE FROM Customers WHERE id = ?', [testCustomerId]);
      }
      if (testProductId1) {
        await db.query('DELETE FROM Sale_Items WHERE product_id = ?', [testProductId1]);
        await db.query('DELETE FROM Returns WHERE product_id = ?', [testProductId1]);
        await db.query('DELETE FROM Products WHERE id = ?', [testProductId1]);
      }
      if (testProductId2) {
        await db.query('DELETE FROM Sale_Items WHERE product_id = ?', [testProductId2]);
        await db.query('DELETE FROM Returns WHERE product_id = ?', [testProductId2]);
        await db.query('DELETE FROM Products WHERE id = ?', [testProductId2]);
      }
    } catch (_) {}
  }
}

if (require.main === module) {
  runFinancialAuditTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ تاقیکردنەوە سەرکەوتوو نەبوو:', err);
      process.exit(1);
    });
}

module.exports = { runFinancialAuditTests };
