require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');
const checkoutController = require('../controllers/checkout');

function mockReqRes(body) {
  let statusCode = 200;
  let responseData = null;
  const req = { body };
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

async function runTest() {
  console.log('=== دەستپێکردنی تاقیکردنەوەی ئۆتۆماتیکی فرە-جۆری پارەدان (Direct Controller Test) ===');
  
  let testCustomerId = null;
  let testProductId = null;
  const barcode = 'TEST_SPLIT_' + Date.now();

  try {
    // 1. Create test customer
    const [custRes] = await db.query(
      "INSERT INTO Customers (name, phone) VALUES ('کڕیاری تاقیکاری فرە-جۆر', '07500000099')"
    );
    testCustomerId = custRes.insertId;
    console.log(`✓ کڕیاری تاقیکاری دروستکرا: ID #${testCustomerId}`);

    // 2. Create test product
    const [prodRes] = await db.query(
      "INSERT INTO Products (name, barcode, cost_price, selling_price, stock) VALUES ('شەربەتی تاقیکاری', ?, 5000, 10000, 100)",
      [barcode]
    );
    testProductId = prodRes.insertId;
    console.log(`✓ کاڵای تاقیکاری دروستکرا: ID #${testProductId}, Barcode: ${barcode}`);

    // 3. Test 1: Full Cash Checkout
    console.log('\n--- تاقیکردنەوەی ١: فرۆشتنی تەواو نەقد (Full Cash) ---');
    const t1 = mockReqRes({
      items: [{ barcode, quantity: 1, price: 10000, name: 'شەربەتی تاقیکاری' }],
      customer_id: null,
      payment_method: 'CASH'
    });
    await checkoutController.processCheckout(t1.req, t1.res);
    const res1 = t1.getResult();
    if (res1.statusCode !== 201) throw new Error('Failed Cash Checkout: ' + JSON.stringify(res1.responseData));
    const cashSaleId = res1.responseData.saleId;
    console.log(`پسووڵەی نەقد تۆمارکرا: #${cashSaleId}`);

    const [cashSaleRows] = await db.query('SELECT * FROM Sales WHERE id = ?', [cashSaleId]);
    const cashSale = cashSaleRows[0];
    if (cashSale.payment_method !== 'CASH' || Number(cashSale.paid_amount) !== 10000 || Number(cashSale.debt_amount) !== 0) {
      throw new Error(`شکستی نەقد: method=${cashSale.payment_method}, paid=${cashSale.paid_amount}, debt=${cashSale.debt_amount}`);
    }
    console.log('✓ فرۆشتنی نەقد بە تەواوی دروست دەرچوو!');

    // 4. Test 2: Full Debt Checkout
    console.log('\n--- تاقیکردنەوەی ٢: فرۆشتنی تەواو قەرز (Full Debt) ---');
    const t2 = mockReqRes({
      items: [{ barcode, quantity: 2, price: 10000, name: 'شەربەتی تاقیکاری' }],
      customer_id: testCustomerId,
      payment_method: 'DEBT'
    });
    await checkoutController.processCheckout(t2.req, t2.res);
    const res2 = t2.getResult();
    if (res2.statusCode !== 201) throw new Error('Failed Debt Checkout: ' + JSON.stringify(res2.responseData));
    const debtSaleId = res2.responseData.saleId;
    console.log(`پسووڵەی قەرز تۆمارکرا: #${debtSaleId}`);

    const [debtSaleRows] = await db.query('SELECT * FROM Sales WHERE id = ?', [debtSaleId]);
    const debtSale = debtSaleRows[0];
    if (debtSale.payment_method !== 'DEBT' || Number(debtSale.paid_amount) !== 0 || Number(debtSale.debt_amount) !== 20000) {
      throw new Error(`شکستی قەرز: method=${debtSale.payment_method}, paid=${debtSale.paid_amount}, debt=${debtSale.debt_amount}`);
    }

    const [debtLedgerRows] = await db.query('SELECT * FROM Customer_Debts WHERE sale_id = ?', [debtSaleId]);
    if (debtLedgerRows.length === 0 || Number(debtLedgerRows[0].amount) !== 20000) {
      throw new Error('شکست لە تۆمارکردنی قەرزی کڕیار لە Customer_Debts');
    }
    console.log('✓ فرۆشتنی قەرز بە تەواوی دروست دەرچوو و تۆمار کرا لە دەفتەری قەرز!');

    // 5. Test 3: Split Payment (کۆی پسووڵە: ٥٠،٠٠٠ د.ع، نەقد: ٢٠،٠٠٠ د.ع، قەرز: ٣٠،٠٠٠ د.ع)
    console.log('\n--- تاقیکردنەوەی ٣: فرە-جۆری پارەدان (Split Payment: ٢٠،٠٠٠ نەقد + ٣٠،٠٠٠ قەرز) ---');
    const t3 = mockReqRes({
      items: [{ barcode, quantity: 5, price: 10000, name: 'شەربەتی تاقیکاری' }],
      customer_id: testCustomerId,
      paid_amount: 20000,
      pay_later_amount: 30000,
      payment_method: 'SPLIT'
    });
    await checkoutController.processCheckout(t3.req, t3.res);
    const res3 = t3.getResult();
    if (res3.statusCode !== 201) throw new Error('Failed Split Checkout: ' + JSON.stringify(res3.responseData));
    const splitSaleId = res3.responseData.saleId;
    console.log(`پسووڵەی تێکەڵ تۆمارکرا: #${splitSaleId}`);

    const [splitSaleRows] = await db.query('SELECT * FROM Sales WHERE id = ?', [splitSaleId]);
    const splitSale = splitSaleRows[0];
    if (splitSale.payment_method !== 'SPLIT') {
      throw new Error(`جۆری پارەدان دەبێت SPLIT بێت بەڵام ${splitSale.payment_method}ە`);
    }
    if (Number(splitSale.paid_amount) !== 20000) {
      throw new Error(`بڕی نەقد دەبێت 20000 بێت بەڵام ${splitSale.paid_amount}ە`);
    }
    if (Number(splitSale.debt_amount) !== 30000) {
      throw new Error(`بڕی قەرز دەبێت 30000 بێت بەڵام ${splitSale.debt_amount}ە`);
    }

    const [splitDebtRows] = await db.query('SELECT * FROM Customer_Debts WHERE sale_id = ?', [splitSaleId]);
    if (splitDebtRows.length === 0 || Number(splitDebtRows[0].amount) !== 30000) {
      throw new Error('قەرزی تێکەڵ بە دروستی لە Customer_Debts تۆمار نەکراوە!');
    }
    console.log(`✓ قەرزی تێکەڵ لە Customer_Debts دۆزرایەوە: بڕی ${splitDebtRows[0].amount} دینار، تێبینی: "${splitDebtRows[0].note}"`);
    console.log('✓ فرە-جۆری پارەدان بە سەرکەوتوویی ١٠٠٪ لە داتابەیس و باکئێند جێبەجێ بوو!');

    // Clean up test records
    await db.query('DELETE FROM Customer_Debts WHERE customer_id = ?', [testCustomerId]);
    await db.query('DELETE FROM Sale_Items WHERE sale_id IN (?, ?, ?)', [cashSaleId, debtSaleId, splitSaleId]);
    await db.query('DELETE FROM Sales WHERE id IN (?, ?, ?)', [cashSaleId, debtSaleId, splitSaleId]);
    await db.query('DELETE FROM Customers WHERE id = ?', [testCustomerId]);
    await db.query('DELETE FROM Products WHERE id = ?', [testProductId]);
    console.log('\n✓ داتای تاقیکارییەکان بە خاوێنی سڕدرانەوە.');
    console.log('=== هەموو تاقیکردنەوەکان ١٠٠٪ بە سەرکەوتوویی تەواوبوون! ===');
    process.exit(0);

  } catch (err) {
    console.error('Test Failed:', err.message);
    if (testCustomerId) {
      await db.query('DELETE FROM Customer_Debts WHERE customer_id = ?', [testCustomerId]).catch(() => {});
      await db.query('DELETE FROM Customers WHERE id = ?', [testCustomerId]).catch(() => {});
    }
    if (testProductId) {
      await db.query('DELETE FROM Products WHERE id = ?', [testProductId]).catch(() => {});
    }
    process.exit(1);
  }
}

runTest();
