require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const assert = require('assert');
const db = require('../db');

const API_BASE = 'http://localhost:3001/api/checkout';

async function runCheckoutFuzzTests() {
    console.log('=== دەستپێکردنی تاقیکردنەوەی وردی سیناریۆکانی کاشێر و چێکئاوت (Checkout Deep Fuzz Tests) ===\n');

    let productId = null;
    let promoId = null;
    let customerId = null;

    try {
        // --- Setup Test Fixtures ---
        const testBarcode = `FUZZ_${Date.now()}`;
        const [prodRes] = await db.query(`
            INSERT INTO Products (name, barcode, cost_price, selling_price, stock, wholesale_price, units_per_box)
            VALUES ('کاڵای پشکنینی فووزینگ', ?, 1000, 2000, 500.000, 18000, 10)
        `, [testBarcode]);
        productId = prodRes.insertId;

        // Add FIFO batch
        await db.query(`
            INSERT INTO Product_Batches (product_id, batch_number, initial_quantity, remaining_quantity, cost_price, status)
            VALUES (?, 'BATCH-FUZZ-01', 500.000, 500.000, 1000, 'ACTIVE')
        `, [productId]);

        // Add a customer
        const [custRes] = await db.query(`
            INSERT INTO Customers (name, phone) VALUES ('کڕیاری تاقیکاری فووز', '07700000000')
        `, []);
        customerId = custRes.insertId;

        // --- 1. Test Micro-weight Fractional Decimal Checkout (0.125 kg) ---
        console.log('--- ١. تاقیکردنەوەی فرۆشتنی کێشانی ورد (Micro-weight: 0.125 kg) ---');
        const microRes = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: [{ barcode: testBarcode, quantity: 0.125, is_custom: false }],
                payment_method: 'CASH'
            })
        });
        assert.strictEqual(microRes.status, 201, 'Micro-weight checkout must return 201');
        const microData = await microRes.json();
        // 0.125 * 2000 = 250 IQD
        assert.strictEqual(microData.total, '250', 'Total must be exactly 250 IQD');
        console.log('✓ فرۆشتنی کێشی 0.125 کگم بە تەواوی بە ٢٥٠ دینار تۆمارکرا');

        // Verify stock deducted accurately (500 - 0.125 = 499.875)
        const [stockCheck1] = await db.query('SELECT stock FROM Products WHERE id = ?', [productId]);
        assert.strictEqual(parseFloat(stockCheck1[0].stock), 499.875, 'Stock must deduct precisely 0.125');
        console.log('✓ مەخزەن بە وردی بووە بە:', stockCheck1[0].stock);

        // --- 2. Test Carton / Box Checkout (unit_type = BOX) ---
        console.log('\n--- ٢. تاقیکردنەوەی فرۆشتنی کارتۆن (Carton / Box Checkout) ---');
        const boxRes = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: [{ barcode: testBarcode, quantity: 2, unit_type: 'BOX', is_custom: false }],
                payment_method: 'CASH'
            })
        });
        assert.strictEqual(boxRes.status, 201, 'Box checkout must return 201');
        const boxData = await boxRes.json();
        // 2 boxes * 18000 wholesale_price = 36000 IQD
        assert.strictEqual(boxData.total, '36000', 'Carton total must be 36000 IQD');
        console.log('✓ فرۆشتنی ٢ کارتۆن بە تەواوی بە ٣٦,٠٠٠ دینار تۆمارکرا');

        // Stock deduction: 2 boxes * 10 units = 20 units. (499.875 - 20 = 479.875)
        const [stockCheck2] = await db.query('SELECT stock FROM Products WHERE id = ?', [productId]);
        assert.strictEqual(parseFloat(stockCheck2[0].stock), 479.875, 'Carton sale must deduct 20 units from stock');
        console.log('✓ مەخزەن بە تەواوی ٢٠ دانەی لێ کەمکرایەوە:', stockCheck2[0].stock);

        // --- 3. Test Empty Cart Validation ---
        console.log('\n--- ٣. تاقیکردنەوەی ڕەتکردنەوەی سەبەتەی بەتاڵ (Empty Cart) ---');
        const emptyRes = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: [] })
        });
        assert.strictEqual(emptyRes.status, 400, 'Empty cart must return 400');
        console.log('✓ سەبەتەی بەتاڵ بە دروستی ڕەتکرایەوە (400 Bad Request)');

        // --- 4. Test Debt Without Customer Rejection ---
        console.log('\n--- ٤. تاقیکردنەوەی ڕەتکردنەوەی قەرز بێ دیاریکردنی کڕیار ---');
        const debtNoCustRes = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: [{ barcode: testBarcode, quantity: 1 }],
                payment_method: 'DEBT'
            })
        });
        const debtNoCustData = await debtNoCustRes.json();
        assert(debtNoCustRes.status >= 400, 'Debt sale without customer must fail');
        console.log('✓ سیستەم ڕێگری لە فرۆشتنی قەرز دەکات بێ کڕیار:', debtNoCustData.message);

        // --- 5. Test Split Payment Precision ---
        console.log('\n--- ٥. تاقیکردنەوەی فرۆشتنی تێکەڵ (Split Payment: Cash + Debt) ---');
        const splitRes = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: [{ barcode: testBarcode, quantity: 5 }], // 5 * 2000 = 10000
                customer_id: customerId,
                payment_method: 'SPLIT',
                paid_amount: 3500,
                pay_later_amount: 6500
            })
        });
        assert.strictEqual(splitRes.status, 201, 'Split payment must succeed');
        const splitData = await splitRes.json();
        assert.strictEqual(splitData.total, '10000', 'Total must be 10000');
        assert.strictEqual(splitData.paid_amount, '3500', 'Paid amount must be 3500');
        assert.strictEqual(splitData.debt_amount, '6500', 'Debt amount must be 6500');
        console.log('✓ دابەشکردنی پارە بە سەرکەوتوویی: ٣,٥٠٠ نەقد + ٦,٥٠٠ قەرز');

        // Verify customer debt ledger record
        const [custDebtCheck] = await db.query(`
            SELECT amount, transaction_type 
            FROM Customer_Debts 
            WHERE customer_id = ? AND sale_id = ?
        `, [customerId, splitData.saleId]);
        assert.strictEqual(custDebtCheck.length, 1, 'Customer debt record must exist');
        assert.strictEqual(custDebtCheck[0].amount, 6500, 'Customer debt amount must match 6500');
        console.log('✓ تۆماری قەرزی کڕیار بە ٦,٥٠٠ دینار لە Customer_Debts دروستکرا');

        // --- 6. Test Multi-item Cart with Custom Scale Items & Extreme Discount ---
        console.log('\n--- ٦. تاقیکردنەوەی تێکەڵکردنی کاڵای دەستی و داشکاندنی گەورە ---');
        const mixedRes = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: [
                    { barcode: testBarcode, quantity: 1, is_custom: false }, // 2000 IQD, cost 1000
                    { is_custom: true, name: 'میوەی کێشراو', price: 4000, quantity: 1.5 } // 6000 IQD
                ],
                discount_amount: 5000, // Total subtotal: 8000 -> final: 3000
                payment_method: 'CASH'
            })
        });
        assert.strictEqual(mixedRes.status, 201, 'Mixed cart checkout must succeed');
        const mixedData = await mixedRes.json();
        assert.strictEqual(mixedData.subtotal, '8000', 'Subtotal must be 8000');
        assert.strictEqual(mixedData.discount, '5000', 'Discount must be 5000');
        assert.strictEqual(mixedData.total, '3000', 'Final total must be 3000');
        console.log('✓ سەبەتەی تێکەڵ بە سەرکەوتوویی ژمێردرا: ٨,٠٠٠ - ٥,٠٠٠ = ٣,٠٠٠ دینار');

        console.log('\n================================================================');
        console.log('🎉 هەموو تاقیکردنەوەکانی مۆدیوڵی ٢ (Checkout Fuzz Tests) ١٠٠٪ سەرکەوتوون!');
        console.log('================================================================');
        process.exit(0);
    } catch (err) {
        console.error('❌ تاقیکردنەوە سەرکەوتوو نەبوو:', err);
        process.exit(1);
    } finally {
        // Clean up
        if (productId) {
            try {
                await db.query('DELETE FROM Sale_Item_Batches WHERE batch_id IN (SELECT id FROM Product_Batches WHERE product_id = ?)', [productId]);
                await db.query('DELETE FROM Product_Batches WHERE product_id = ?', [productId]);
                await db.query('DELETE FROM Sale_Items WHERE product_id = ?', [productId]);
                await db.query('DELETE FROM Products WHERE id = ?', [productId]);
            } catch (_) {}
        }
        if (customerId) {
            try {
                await db.query('DELETE FROM Customer_Debts WHERE customer_id = ?', [customerId]);
                await db.query('DELETE FROM Customers WHERE id = ?', [customerId]);
            } catch (_) {}
        }
    }
}

runCheckoutFuzzTests();
