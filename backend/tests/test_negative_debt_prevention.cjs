const db = require('../db');
const checkoutController = require('../controllers/checkout');
const returnsController = require('../controllers/returns');

function mockReqRes(body, params = {}) {
  let statusCode = 200;
  let responseData = null;
  const req = { body, params, headers: { 'x-user-name': 'تەستەری قەرز' } };
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

async function testNegativeDebtPrevention() {
  console.log('=== تاقیکردنەوەی بەرگریکردن لە قەرزی نێگەتیڤ (Negative Debt Protection) ===');

  let testCustId = null;
  let testProdId = null;
  let testProd2Id = null;
  const barcode1 = 'BARCODE_NEG_' + Date.now();
  const barcode2 = 'BARCODE_NEG2_' + Date.now();

  try {
    // 1. Create customer
    const [cRes] = await db.query(
      "INSERT INTO Customers (name, phone) VALUES ('تەستەری دژە نێگەتیڤ', '07700000099')"
    );
    testCustId = cRes.insertId;

    // 2. Create product (price: 10,000)
    const [pRes] = await db.query(
      "INSERT INTO Products (name, barcode, selling_price, cost_price, stock, unit) VALUES ('کاڵای گران', ?, 10000, 7000, 50, 'دانە')",
      [barcode1]
    );
    testProdId = pRes.insertId;

    // 3. Create product 2 (price: 6,000)
    const [pRes2] = await db.query(
      "INSERT INTO Products (name, barcode, selling_price, cost_price, stock, unit) VALUES ('کاڵای بچووک', ?, 6000, 4000, 50, 'دانە')",
      [barcode2]
    );
    testProd2Id = pRes2.insertId;

    const salePayload = {
      items: [
        { barcode: barcode1, quantity: 1, price: 10000, name: 'کاڵای گران' },
        { barcode: barcode2, quantity: 1, price: 6000, name: 'کاڵای بچووک' }
      ],
      payment_method: 'SPLIT',
      paid_amount: 15000,
      pay_later_amount: 1000,
      customer_id: testCustId
    };

    const tSale = mockReqRes(salePayload);
    await checkoutController.processCheckout(tSale.req, tSale.res);
    const saleResult = tSale.getResult();
    if (saleResult.statusCode !== 201) {
      throw new Error('Sale failed: ' + JSON.stringify(saleResult.responseData));
    }
    const saleId = saleResult.responseData.saleId;
    console.log(`✓ پسووڵەی تێکەڵ تۆمارکرا: #${saleId} (کۆی گشتی: 16,000، نەقد: 15,000، قەرز: 1,000)`);

    // Verify initial debt is 1,000
    const [debt1] = await db.query(
      "SELECT SUM(CASE WHEN transaction_type = 'ADD' THEN amount ELSE -amount END) as total FROM Customer_Debts WHERE customer_id = ?",
      [testCustId]
    );
    console.log(`✓ قەرزی دەستپێکی کڕیار: ${debt1[0].total} دینار`);
    if (Number(debt1[0].total) !== 1000) throw new Error('قەرزی سەرەتا هەڵەیە!');

    // 4. Return the 10,000 item with refund_method = 'DEBT'
    const returnPayload = {
      sale_id: saleId,
      product_id: testProdId,
      quantity: 1,
      reason: 'تاقیکردنەوەی گەڕاندنەوە',
      refund_method: 'DEBT'
    };

    const tRet = mockReqRes(returnPayload);
    await returnsController.processReturn(tRet.req, tRet.res);
    const retResult = tRet.getResult();
    if (retResult.statusCode !== 200) {
      throw new Error('Return failed: ' + JSON.stringify(retResult.responseData));
    }
    console.log(`✓ گەڕاندنەوە ئەنجامدرا بە سەرکەوتوویی`);

    // 5. Verify customer debt is exactly 0 (NOT -9,000!)
    const [debt2] = await db.query(
      "SELECT SUM(CASE WHEN transaction_type = 'ADD' THEN amount ELSE -amount END) as total FROM Customer_Debts WHERE customer_id = ?",
      [testCustId]
    );
    console.log(`✓ قەرزی کڕیار دوای گەڕاندنەوەی کاڵای ١٠،٠٠٠ دیناری: ${debt2[0].total} دینار`);
    if (Number(debt2[0].total) !== 0) {
      throw new Error(`قەرزی کڕیار نێگەتیڤ بووە یان سفر نییە! نرخەکە: ${debt2[0].total}`);
    }

    // 6. Check the Customer_Debts record
    const [cdRows] = await db.query(
      "SELECT * FROM Customer_Debts WHERE customer_id = ? AND transaction_type = 'PAY'",
      [testCustId]
    );
    console.log(`✓ تۆماری داشکاندن لە قەرز لە خشتەکەدا: بڕی ${cdRows[0].amount} دینار کەمکراوەتەوە (نەک ١٠،٠٠٠)`);
    if (Number(cdRows[0].amount) !== 1000) {
      throw new Error(`بڕی داشکاندن دەبوو ١،٠٠٠ بێت بەڵام ${cdRows[0].amount} تۆمارکراوە!`);
    }

    console.log('✓ هەموو پشکنینەکان بە تەواوی و ١٠٠٪ سەرکەوتوو بوون!');
  } finally {
    // Cleanup
    if (testCustId) {
      await db.query('DELETE FROM Returns WHERE customer_id = ?', [testCustId]).catch(() => {});
      await db.query('DELETE FROM Customer_Debts WHERE customer_id = ?', [testCustId]).catch(() => {});
      await db.query('DELETE FROM Sale_Items WHERE sale_id IN (SELECT id FROM Sales WHERE customer_id = ?)', [testCustId]).catch(() => {});
      await db.query('DELETE FROM Sales WHERE customer_id = ?', [testCustId]).catch(() => {});
      await db.query('DELETE FROM Customers WHERE id = ?', [testCustId]).catch(() => {});
    }
    if (testProdId) await db.query('DELETE FROM Products WHERE id = ?', [testProdId]).catch(() => {});
    if (testProd2Id) await db.query('DELETE FROM Products WHERE id = ?', [testProd2Id]).catch(() => {});
  }
}

testNegativeDebtPrevention().then(() => process.exit(0)).catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
