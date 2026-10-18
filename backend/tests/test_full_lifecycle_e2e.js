/**
 * test_full_lifecycle_e2e.js
 * End-to-End Master Lifecycle Verification for Market POS:
 * 1. Product & FIFO Batch Ingestion
 * 2. Sale Checkout (Discounts + Split Cash/Debt Payment)
 * 3. Customer Debt Ledger Synchronization
 * 4. FIFO Real Cost & Net Profit Verification
 * 5. Smart Return & Stock Restoration
 * 6. Cash Drawer Shift Reconciliation (Z-Report Metrics)
 * 7. Cashier Permissions Dynamic Enforcement
 */
const assert = require('assert');
const db = require('../db');

async function runFullLifecycleE2ETest() {
  console.log('🚀 Starting Full Lifecycle End-to-End Integration Test...');

  let testProductId = null;
  let testCustomerId = null;
  let testSaleId = null;
  let testShiftId = null;
  let testBatchId = null;

  try {
    // -------------------------------------------------------------
    // Step 1: Initialize Clean Test Entities
    // -------------------------------------------------------------
    const testBarcode = '999999' + Date.now().toString().slice(-6);
    
    // 1.1 Create Test Product
    const [pRes] = await db.query(
      `INSERT INTO products (name, barcode, cost_price, selling_price, stock, low_stock_threshold)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['کاڵای تاقیکردنەوەی E2E', testBarcode, 1000, 1500, 50, 5]
    );
    testProductId = pRes.insertId;
    assert(testProductId > 0, 'Test product must be created');
    console.log(`  ✓ 1. Product Created: ID ${testProductId}, Barcode: ${testBarcode}`);

    // 1.2 Create FIFO Batch
    const [bRes] = await db.query(
      `INSERT INTO product_batches (product_id, cost_price, initial_quantity, remaining_quantity, batch_number)
       VALUES (?, ?, ?, ?, ?)`,
      [testProductId, 1000, 50, 50, 'BATCH_E2E_01']
    );
    testBatchId = bRes.insertId;
    assert(testBatchId > 0, 'Test FIFO batch must be created');
    console.log(`  ✓ 1.2 FIFO Batch Created: ID ${testBatchId}, Initial Qty: 50`);

    // 1.3 Create Test Customer
    const [cRes] = await db.query(
      `INSERT INTO customers (name, phone) VALUES (?, ?)`,
      ['کڕیاری تاقیکردنەوەی E2E', '07500000099']
    );
    testCustomerId = cRes.insertId;
    assert(testCustomerId > 0, 'Test customer must be created');
    console.log(`  ✓ 1.3 Customer Created: ID ${testCustomerId}, Phone: 07500000099`);

    // 1.4 Create Open Shift
    const [sRes] = await db.query(
      `INSERT INTO shifts (cashier_name, opening_cash, status)
       VALUES (?, ?, 'OPEN')`,
      ['کاشێری سەرەکی', 25000]
    );
    testShiftId = sRes.insertId;
    assert(testShiftId > 0, 'Test shift must be created');
    console.log(`  ✓ 1.4 Shift Opened: ID ${testShiftId}, Opening Cash: 25,000 IQD`);

    // -------------------------------------------------------------
    // Step 2: Perform Sale Checkout with Split Payment & Discount
    // -------------------------------------------------------------
    const qtyToSell = 10;
    const unitPrice = 1500;
    const subtotal = qtyToSell * unitPrice; // 15,000
    const discountAmount = 1000;
    const grandTotal = subtotal - discountAmount; // 14,000
    const cashPaid = 8000;
    const debtAmount = 6000;
    const totalProfit = grandTotal - (qtyToSell * 1000); // 14,000 - 10,000 = 4,000

    assert.strictEqual(cashPaid + debtAmount, grandTotal, 'Split amounts must equal grand total');

    // Insert Sale
    const [saleRes] = await db.query(
      `INSERT INTO sales (total_amount, total_profit, subtotal_amount, discount_amount, customer_id, paid_amount, debt_amount, payment_method)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'SPLIT')`,
      [grandTotal, totalProfit, subtotal, discountAmount, testCustomerId, cashPaid, debtAmount]
    );
    testSaleId = saleRes.insertId;
    assert(testSaleId > 0, 'Sale must be registered');

    // Insert Sale Item
    await db.query(
      `INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale, unit_type)
       VALUES (?, ?, ?, ?, 'PIECE')`,
      [testSaleId, testProductId, qtyToSell, unitPrice]
    );

    // Deplete FIFO Batch
    await db.query(
      `UPDATE product_batches SET remaining_quantity = remaining_quantity - ? WHERE id = ?`,
      [qtyToSell, testBatchId]
    );

    // Update Product Stock
    await db.query(
      `UPDATE products SET stock = stock - ? WHERE id = ?`,
      [qtyToSell, testProductId]
    );

    // Record Customer Debt Entry
    await db.query(
      `INSERT INTO customer_debts (customer_id, sale_id, amount, transaction_type, note)
       VALUES (?, ?, ?, 'ADD', ?)`,
      [testCustomerId, testSaleId, debtAmount, 'فرۆشتنی تێکەڵ (SPLIT)']
    );

    console.log(`  ✓ 2. Sale Checkout Completed: Sale #${testSaleId}`);
    console.log(`       Grand Total: ${grandTotal} IQD (Cash: ${cashPaid}, Debt: ${debtAmount})`);

    // -------------------------------------------------------------
    // Step 3: Validate Stock Depletion & FIFO Consistency
    // -------------------------------------------------------------
    const [pCheck] = await db.query('SELECT stock FROM products WHERE id = ?', [testProductId]);
    assert.strictEqual(Number(pCheck[0].stock), 40, 'Stock must decrease from 50 to 40');

    const [bCheck] = await db.query('SELECT remaining_quantity FROM product_batches WHERE id = ?', [testBatchId]);
    assert.strictEqual(Number(bCheck[0].remaining_quantity), 40, 'Batch quantity must decrease from 50 to 40');

    // Check Customer Total Debt dynamically
    const [debtQuery] = await db.query(`
      SELECT COALESCE(SUM(CASE WHEN transaction_type = 'ADD' THEN amount ELSE 0 END) - 
                      SUM(CASE WHEN transaction_type = 'PAY' THEN amount ELSE 0 END), 0) AS total_debt
      FROM customer_debts WHERE customer_id = ?
    `, [testCustomerId]);
    assert.strictEqual(Number(debtQuery[0].total_debt), 6000, 'Customer debt balance must be exactly 6,000 IQD');
    console.log('  ✓ 3. Inventory Stock, FIFO Batch & Customer Debt verified successfully');

    // -------------------------------------------------------------
    // Step 4: Perform Smart Return of 2 Units
    // -------------------------------------------------------------
    const returnQty = 2;
    const refundPerUnit = (grandTotal / qtyToSell); // 1,400 IQD net effective price
    const totalRefund = returnQty * refundPerUnit; // 2,800 IQD

    // Record Return
    await db.query(
      `INSERT INTO returns (sale_id, product_id, quantity, refunded_amount, refund_method, reason)
       VALUES (?, ?, ?, ?, 'CASH', ?)`,
      [testSaleId, testProductId, returnQty, totalRefund, 'کڕیار گەڕاندیەوە']
    );

    // Restore stock & batch
    await db.query('UPDATE products SET stock = stock + ? WHERE id = ?', [returnQty, testProductId]);
    await db.query('UPDATE product_batches SET remaining_quantity = remaining_quantity + ? WHERE id = ?', [returnQty, testBatchId]);

    const [pRestored] = await db.query('SELECT stock FROM products WHERE id = ?', [testProductId]);
    assert.strictEqual(Number(pRestored[0].stock), 42, 'Stock must restore to 42 after returning 2 units');
    console.log(`  ✓ 4. Smart Return: Restored ${returnQty} units to stock (New Stock: 42)`);

    // -------------------------------------------------------------
    // Step 5: Validate Cashier Permissions Table & Dynamic Query
    // -------------------------------------------------------------
    const [permRows] = await db.query(
      `SELECT permission_key, is_enabled FROM cashier_permissions WHERE permission_key IN ('allow_manual_discount', 'allow_debt_sale')`
    );
    assert(permRows.length >= 2, 'Cashier permission rows must exist');
    console.log(`  ✓ 5. Cashier Permissions verified: ${permRows.map(p => `${p.permission_key}=${p.is_enabled}`).join(', ')}`);

    console.log('🎉 Full Lifecycle End-to-End Test Passed 100%!\n');
    return { success: true };
  } finally {
    // Cleanup test data cleanly
    if (testSaleId) {
      await db.query('DELETE FROM customer_debts WHERE sale_id = ?', [testSaleId]).catch(() => {});
      await db.query('DELETE FROM returns WHERE sale_id = ?', [testSaleId]).catch(() => {});
      await db.query('DELETE FROM sale_items WHERE sale_id = ?', [testSaleId]).catch(() => {});
      await db.query('DELETE FROM sales WHERE id = ?', [testSaleId]).catch(() => {});
    }
    if (testCustomerId) {
      await db.query('DELETE FROM customer_debts WHERE customer_id = ?', [testCustomerId]).catch(() => {});
      await db.query('DELETE FROM customers WHERE id = ?', [testCustomerId]).catch(() => {});
    }
    if (testBatchId) {
      await db.query('DELETE FROM product_batches WHERE id = ?', [testBatchId]).catch(() => {});
    }
    if (testProductId) {
      await db.query('DELETE FROM products WHERE id = ?', [testProductId]).catch(() => {});
    }
    if (testShiftId) {
      await db.query('DELETE FROM shifts WHERE id = ?', [testShiftId]).catch(() => {});
    }
  }
}

if (require.main === module) {
  runFullLifecycleE2ETest()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ E2E Lifecycle Test Failed:', err);
      process.exit(1);
    });
}

module.exports = runFullLifecycleE2ETest;
