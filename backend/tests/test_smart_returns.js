require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');
const checkoutController = require('../controllers/checkout');
const returnsController = require('../controllers/returns');

function mockReqRes(body, params = {}) {
  let statusCode = 200;
  let responseData = null;
  const req = { body, params };
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

async function runTests() {
  console.log('=== دەستپێکردنی تاقیکردنەوەی زیرەکی گەڕاندنەوە (Smart Returns Test) ===');

  let testCustId = null;
  let testPieceProdId = null;
  let testBoxProdId = null;
  const barcodePiece = 'TEST_RET_P_' + Date.now();
  const barcodeBox = 'TEST_RET_B_' + Date.now();

  try {
    // 1. Create test customer
    const [cRes] = await db.query(
      "INSERT INTO Customers (name, phone) VALUES ('کڕیاری تاقیکاری گەڕاندنەوە', '07700000088')"
    );
    testCustId = cRes.insertId;
    console.log(`✓ کڕیاری تاقیکاری دروستکرا: ID #${testCustId}`);

    // 2. Create piece product (price: 15,000, stock: 100)
    const [p1Res] = await db.query(
      "INSERT INTO Products (name, barcode, cost_price, selling_price, stock) VALUES ('کاڵای دانە', ?, 10000, 15000, 100)",
      [barcodePiece]
    );
    testPieceProdId = p1Res.insertId;

    // 3. Create carton/box product (units_per_box: 12, piece price: 2,000, box price: 20,000, stock: 120)
    const [p2Res] = await db.query(
      "INSERT INTO Products (name, barcode, box_barcode, units_per_box, cost_price, selling_price, wholesale_price, stock) VALUES ('شەربەتی کارتۆن', 'BOX_PIECE_BC', ?, 12, 1000, 2000, 20000, 120)",
      [barcodeBox]
    );
    testBoxProdId = p2Res.insertId;
    console.log(`✓ کاڵاکان دروستکران: دانە #${testPieceProdId}, کارتۆن #${testBoxProdId}`);

    // ==========================================
    // TEST 1: DEBT SALE & DEBT RETURN SETTLEMENT
    // ==========================================
    console.log('\n--- تاقیکردنەوەی ١: فرۆشتنی قەرز و گەڕاندنەوە (داشکاندن لە قەرزی کڕیار) ---');
    const tSale1 = mockReqRes({
      items: [{ barcode: barcodePiece, quantity: 2, price: 15000, name: 'کاڵای دانە' }],
      customer_id: testCustId,
      payment_method: 'DEBT'
    });
    await checkoutController.processCheckout(tSale1.req, tSale1.res);
    const saleDebtId = tSale1.getResult().responseData.saleId;
    console.log(`پسووڵەی قەرز تۆمارکرا: #${saleDebtId} (کۆی گشتی: ٣٠،٠٠٠ د.ع)`);

    // Check customer debt before return
    const [debtBefore] = await db.query(
      "SELECT SUM(CASE WHEN transaction_type = 'ADD' THEN amount ELSE -amount END) as total FROM Customer_Debts WHERE customer_id = ?",
      [testCustId]
    );
    console.log(`قەرزی کڕیار پێش گەڕاندنەوە: ${debtBefore[0].total} دینار`);
    if (Number(debtBefore[0].total) !== 30000) throw new Error('قەرزی پێش گەڕاندنەوە هەڵەیە!');

    // Check stock before return
    const [prodBefore] = await db.query('SELECT stock FROM Products WHERE id = ?', [testPieceProdId]);
    console.log(`مەخزەن پێش گەڕاندنەوە: ${prodBefore[0].stock} دانە`);
    if (Number(prodBefore[0].stock) !== 98) throw new Error('مەخزەن دەبێت 98 بێت!');

    // Process Return: 1 item from debt sale
    const tRet1 = mockReqRes({
      sale_id: saleDebtId,
      product_id: testPieceProdId,
      quantity: 1,
      reason: 'نەویستراو',
      refund_method: 'DEBT'
    });
    await returnsController.processReturn(tRet1.req, tRet1.res);
    const resRet1 = tRet1.getResult();
    if (resRet1.statusCode !== 200) throw new Error('Return failed: ' + JSON.stringify(resRet1.responseData));

    // Check stock after return
    const [prodAfter1] = await db.query('SELECT stock FROM Products WHERE id = ?', [testPieceProdId]);
    console.log(`✓ مەخزەن دوای گەڕاندنەوەی ١ دانە: ${prodAfter1[0].stock} (زیادبوویەوە بۆ 99)`);
    if (Number(prodAfter1[0].stock) !== 99) throw new Error('مەخزەن بە دروستی زیاد نەبوویەوە!');

    // Check customer debt after return
    const [debtAfter] = await db.query(
      "SELECT SUM(CASE WHEN transaction_type = 'ADD' THEN amount ELSE -amount END) as total FROM Customer_Debts WHERE customer_id = ?",
      [testCustId]
    );
    console.log(`✓ قەرزی کڕیار دوای گەڕاندنەوە: ${debtAfter[0].total} دینار (١٥،٠٠٠ دینار کەمبوویەوە لە قەرزەکەی)`);
    if (Number(debtAfter[0].total) !== 15000) throw new Error('قەرزی کڕیار بە دروستی کەم نەکرایەوە!');

    // Check Returns table record
    const [ret1Rows] = await db.query('SELECT * FROM Returns WHERE sale_id = ?', [saleDebtId]);
    if (ret1Rows[0].refund_method !== 'DEBT' || ret1Rows[0].customer_id !== testCustId || !ret1Rows[0].debt_transaction_id) {
      throw new Error('تۆماری Returns هەڵەیە: ' + JSON.stringify(ret1Rows[0]));
    }
    console.log('✓ فرۆشتن و گەڕاندنەوەی قەرز ١٠٠٪ بە سەرکەوتوویی تێپەڕی!');

    // ==========================================
    // TEST 2: CASH SALE & CASH RETURN SETTLEMENT
    // ==========================================
    console.log('\n--- تاقیکردنەوەی ٢: فرۆشتنی نەقد و گەڕاندنەوە (دانەوە لە سندوق) ---');
    const tSale2 = mockReqRes({
      items: [{ barcode: barcodePiece, quantity: 2, price: 15000, name: 'کاڵای دانە' }],
      customer_id: null,
      payment_method: 'CASH'
    });
    await checkoutController.processCheckout(tSale2.req, tSale2.res);
    const saleCashId = tSale2.getResult().responseData.saleId;
    console.log(`پسووڵەی نەقد تۆمارکرا: #${saleCashId}`);

    // Return 1 item from cash sale
    const tRet2 = mockReqRes({
      sale_id: saleCashId,
      product_id: testPieceProdId,
      quantity: 1,
      reason: 'کەموکوڕی دار',
      refund_method: 'CASH'
    });
    await returnsController.processReturn(tRet2.req, tRet2.res);
    const resRet2 = tRet2.getResult();
    if (resRet2.statusCode !== 200) throw new Error('Cash Return failed: ' + JSON.stringify(resRet2.responseData));

    // Verify Returns record
    const [ret2Rows] = await db.query('SELECT * FROM Returns WHERE sale_id = ?', [saleCashId]);
    if (ret2Rows[0].refund_method !== 'CASH' || ret2Rows[0].debt_transaction_id !== null) {
      throw new Error('تۆماری گەڕاندنەوەی نەقد هەڵەیە: ' + JSON.stringify(ret2Rows[0]));
    }
    console.log('✓ گەڕاندنەوەی نەقد تۆمارکرا بە refund_method = CASH و لە سندوق کەم دەبێتەوە');

    // ==========================================
    // TEST 3: CARTON RETURN (WHOLESALE MULTIPLIER)
    // ==========================================
    console.log('\n--- تاقیکردنەوەی ٣: گەڕاندنەوەی کارتۆن (فرۆشتنی جوملە) ---');
    // Sell 1 carton (12 units)
    const tSale3 = mockReqRes({
      items: [{ barcode: barcodeBox, quantity: 1, unit_type: 'BOX', price: 20000, name: 'شەربەتی کارتۆن' }],
      customer_id: null,
      payment_method: 'CASH'
    });
    await checkoutController.processCheckout(tSale3.req, tSale3.res);
    const saleBoxId = tSale3.getResult().responseData.saleId;

    const [boxProdMid] = await db.query('SELECT stock FROM Products WHERE id = ?', [testBoxProdId]);
    console.log(`مەخزەنی کارتۆن دوای فرۆشتنی ١ کارتۆن: ${boxProdMid[0].stock} (١٢ دانە کەمبوویەوە لە ١٢٠)`);
    if (Number(boxProdMid[0].stock) !== 108) throw new Error('مەخزەنی فرۆشتنی کارتۆن هەڵەیە!');

    // Return 1 carton
    const tRet3 = mockReqRes({
      sale_id: saleBoxId,
      product_id: testBoxProdId,
      quantity: 1,
      reason: 'گەڕاندنەوەی کارتۆن',
      refund_method: 'CASH'
    });
    await returnsController.processReturn(tRet3.req, tRet3.res);

    const [boxProdAfter] = await db.query('SELECT stock FROM Products WHERE id = ?', [testBoxProdId]);
    console.log(`✓ مەخزەنی کارتۆن دوای گەڕاندنەوەی ١ کارتۆن: ${boxProdAfter[0].stock} (١٢ دانە گەڕایەوە بۆ ١٢٠)`);
    if (Number(boxProdAfter[0].stock) !== 120) throw new Error('مەخزەنی گەڕاندنەوەی کارتۆن هەڵەیە!');

    // ==========================================
    // TEST 4: INVOICE WITH MANUAL DISCOUNT AND PROPORTIONAL RETURN
    // ==========================================
    console.log('\n--- تاقیکردنەوەی ٤: گەڕاندنەوەی پسووڵەی داشکاندنکراو بە شێوازی ڕێژەیی (Proportional Discount Return) ---');
    const barcodeDisc = 'TEST_DISC_' + Date.now();
    const [pDiscRes] = await db.query(
      "INSERT INTO Products (name, barcode, cost_price, selling_price, stock) VALUES ('شای عێراقی', ?, 1500, 2500, 100)",
      [barcodeDisc]
    );
    const testDiscProdId = pDiscRes.insertId;

    // Checkout: 10 units x 2,500 = 25,000. Discount = 5,000. Net Total = 20,000
    const tSale4 = mockReqRes({
      items: [{ barcode: barcodeDisc, quantity: 10, price: 2500, name: 'شای عێراقی' }],
      customer_id: null,
      payment_method: 'CASH',
      discount_amount: 5000
    });
    await checkoutController.processCheckout(tSale4.req, tSale4.res);
    const saleDiscId = tSale4.getResult().responseData.saleId;
    console.log(`پسووڵەی داشکاندن تۆمارکرا: #${saleDiscId} (کۆی گشتی: ٢٠،٠٠٠ د.ع دوای داشکاندنی ٥،٠٠٠ د.ع)`);

    // Fetch sale for return via getSaleForReturn
    const tGetSale = mockReqRes({}, { id: saleDiscId });
    await returnsController.getSaleForReturn(tGetSale.req, tGetSale.res);
    const saleForRetData = tGetSale.getResult().responseData.data;

    console.log(`نرخی کڕدراو بە داشکاندنەوە: ${saleForRetData.items[0].effective_unit_price} د.ع (دەبێت 2000 بێت)`);
    if (saleForRetData.items[0].effective_unit_price !== 2000) {
      throw new Error(`effective_unit_price دەبێت 2000 بێت بەڵام دەرچوو: ${saleForRetData.items[0].effective_unit_price}`);
    }
    if (saleForRetData.remaining_refundable_total !== 20000) {
      throw new Error(`remaining_refundable_total دەبێت 20000 بێت بەڵام دەرچوو: ${saleForRetData.remaining_refundable_total}`);
    }

    // Partial Return: 5 units out of 10
    const tRet4Partial = mockReqRes({
      sale_id: saleDiscId,
      product_id: testDiscProdId,
      quantity: 5,
      reason: 'گەڕاندنەوەی نیوەی بار',
      refund_method: 'CASH'
    });
    await returnsController.processReturn(tRet4Partial.req, tRet4Partial.res);
    const partialRefunded = tRet4Partial.getResult().responseData.refunded_amount;
    console.log(`✓ پارەی گەڕاوە بۆ ٥ دانە: ${partialRefunded} دینار (دەبێت بە تەواوی ١٠،٠٠٠ دینار بێت نەک ١٢،٥٠٠)`);
    if (partialRefunded !== 10000) {
      throw new Error(`پارەی گەڕاوەی بەشەکی دەبێت 10000 بێت بەڵام دەرچوو: ${partialRefunded}`);
    }

    // Remaining Return: 5 units remaining
    const tRet4Final = mockReqRes({
      sale_id: saleDiscId,
      product_id: testDiscProdId,
      quantity: 5,
      reason: 'گەڕاندنەوەی ٥ دانەی کۆتایی',
      refund_method: 'CASH'
    });
    await returnsController.processReturn(tRet4Final.req, tRet4Final.res);
    const finalRefunded = tRet4Final.getResult().responseData.refunded_amount;
    console.log(`✓ پارەی گەڕاوە بۆ ٥ دانەی دووەم: ${finalRefunded} دینار (دەبێت بە تەواوی ١٠،٠٠٠ دینار بێت)`);
    if (finalRefunded !== 10000) {
      throw new Error(`پارەی گەڕاوەی کۆتایی دەبێت 10000 بێت بەڵام دەرچوو: ${finalRefunded}`);
    }

    // Verify cumulative refunds
    const [cumRefunds] = await db.query('SELECT SUM(refunded_amount) as total FROM Returns WHERE sale_id = ?', [saleDiscId]);
    console.log(`✓ کۆی گشتی هەردوو گەڕاندنەوەکە: ${cumRefunds[0].total} دینار (ڕێک دەقاوودەق یەکسانە بە ٢٠،٠٠٠ دینار)`);
    if (Number(cumRefunds[0].total) !== 20000) {
      throw new Error(`کۆی گەڕاوە دەبێت 20000 بێت بەڵام دەرچوو: ${cumRefunds[0].total}`);
    }

    // Clean up test data
    console.log('\n--- پاککردنەوەی داتای تاقیکارییەکان ---');
    await db.query('DELETE FROM Customer_Debts WHERE customer_id = ?', [testCustId]);
    await db.query('DELETE FROM Returns WHERE sale_id IN (?, ?, ?, ?)', [saleDebtId, saleCashId, saleBoxId, saleDiscId]);
    await db.query('DELETE FROM Sale_Items WHERE sale_id IN (?, ?, ?, ?)', [saleDebtId, saleCashId, saleBoxId, saleDiscId]);
    await db.query('DELETE FROM Sales WHERE id IN (?, ?, ?, ?)', [saleDebtId, saleCashId, saleBoxId, saleDiscId]);
    await db.query('DELETE FROM Customers WHERE id = ?', [testCustId]);
    await db.query('DELETE FROM Products WHERE id IN (?, ?, ?)', [testPieceProdId, testBoxProdId, testDiscProdId]);
    console.log('✓ هەموو داتاکانی تاقیکردنەوە بە خاوێنی سڕدرانەوە.');
    console.log('=== هەموو تاقیکردنەوەکانی زیرەکی گەڕاندنەوە ١٠٠٪ سەرکەوتوو بوون! ===');
    process.exit(0);

  } catch (err) {
    console.error('Test Failed:', err.message);
    if (testCustId) {
      await db.query('DELETE FROM Customer_Debts WHERE customer_id = ?', [testCustId]).catch(() => {});
      await db.query('DELETE FROM Customers WHERE id = ?', [testCustId]).catch(() => {});
    }
    if (testPieceProdId || testBoxProdId) {
      await db.query('DELETE FROM Products WHERE id IN (?, ?)', [testPieceProdId, testBoxProdId]).catch(() => {});
    }
    process.exit(1);
  }
}

runTests();
