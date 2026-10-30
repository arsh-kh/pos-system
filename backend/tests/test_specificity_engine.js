/**
 * test_specificity_engine.js
 * 
 * Comprehensive QA Test Suite for Price, Promotion, and Discount Specificity Engine.
 * Tests:
 *  - Scenario A: Overlapping Discounts (Compounding vs Exclusive)
 *  - Scenario B: Tiered Specificity Hierarchy (Custom > Box Wholesale > SKU Promo > Batch Price > Catalog Price)
 *  - Scenario C: Time-Bound and Scheduled Specificity (Active vs Expired vs Scheduled)
 *  - Scenario D: Returns and Refunds After Discount (Proportional Scaling & Multi-buy Blending)
 *  - Scenario E: Tied Specificity Conflict (Frontend activeMap vs Backend checkout tie-breakers)
 *  - Scenario F: Dynamic Quantity Thresholds (max_qty_per_sale specificity boundary)
 */

const assert = require('assert');
const db = require('../db');

const API_BASE = 'http://localhost:3001/api';

async function runSpecificityTests() {
  console.log('========================================================================');
  console.log('🔍 دەستپێکردنی تاقیکردنەوەی بزوێنەری تایبەتمەندی و ئەولەویەتی داشکاندن و نرخ');
  console.log('   (Specificity Calculation & Pricing Precedence Test Suite)');
  console.log('========================================================================\n');

  const testSuffix = Date.now();
  let testProductId = null;
  let testCustomer = null;
  let createdPromoIds = [];
  let createdSaleIds = [];

  try {
    // -------------------------------------------------------------------------
    // Setup Base Test Fixtures
    // -------------------------------------------------------------------------
    const [prodRes] = await db.query(`
      INSERT INTO Products (
        name, barcode, cost_price, selling_price, wholesale_price, stock, units_per_box
      ) VALUES (
        'کاڵای تاقیکاری تایبەتمەندی', ?, 4000, 10000, 80000, 100.000, 10
      )
    `, [`SPEC_SKU_${testSuffix}`]);
    testProductId = prodRes.insertId;

    // Create an active FIFO batch with higher selling price (12,000 IQD) to test batch override
    await db.query(`
      INSERT INTO Product_Batches (
        product_id, batch_number, initial_quantity, remaining_quantity, cost_price, selling_price, units_per_box, status
      ) VALUES (
        ?, 'BATCH-SPEC-01', 50.000, 50.000, 4500, 12000, 10, 'ACTIVE'
      )
    `, [testProductId]);

    // Create a test customer
    const [custRes] = await db.query(`
      INSERT INTO Customers (name, phone) VALUES (?, '07509999999')
    `, [`کڕیاری تاقیکاری تایبەتمەندی ${testSuffix}`]);
    testCustomer = custRes.insertId;

    console.log(`✓ کاڵای تاقیکاری دروستکرا: ID ${testProductId} (نرخی کەتەلۆگ: 10,000، نرخی باچ: 12,000، نرخی کارتۆن: 80,000)`);

    // =========================================================================
    // SCENARIO B: Tiered Specificity Hierarchy
    // (Custom Override > Carton Wholesale > SKU Promo > Batch Price > Catalog Price)
    // =========================================================================
    console.log('\n--- [Scenario B] پشکنینی پلەبەندیی تایبەتمەندی (Tiered Specificity Hierarchy) ---');

    // Level 1: Normal Piece without promo should pick Batch Price (12,000 IQD) over Catalog Price (10,000 IQD)
    const baseSaleRes = await fetch(`${API_BASE}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ barcode: `SPEC_SKU_${testSuffix}`, quantity: 1, unit_type: 'PIECE' }],
        payment_method: 'CASH'
      })
    });
    const baseSaleData = await baseSaleRes.json();
    if (baseSaleData.saleId) createdSaleIds.push(baseSaleData.saleId);
    assert.strictEqual(baseSaleRes.status, 201, 'Base piece checkout should succeed');
    assert.strictEqual(baseSaleData.total, '12000', 'Active batch selling_price (12000) must override catalog price (10000)');
    console.log('✓ ئەولەویەتی ١: نرخی باچی چالاک (12,000 د.ع) زاڵ بوو بەسەر نرخی بنەڕەتی کەتەلۆگ (10,000 د.ع)');

    // Level 2: Carton Wholesale Price must override single unit price
    const boxSaleRes = await fetch(`${API_BASE}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ barcode: `SPEC_SKU_${testSuffix}`, quantity: 1, unit_type: 'BOX' }],
        payment_method: 'CASH'
      })
    });
    const boxSaleData = await boxSaleRes.json();
    if (boxSaleData.saleId) createdSaleIds.push(boxSaleData.saleId);
    assert.strictEqual(boxSaleRes.status, 201, 'Box checkout should succeed');
    assert.strictEqual(boxSaleData.total, '80000', 'Carton wholesale price (80000) must take precedence for BOX unit_type');
    console.log('✓ ئەولەویەتی ٢: نرخی کارتۆن/کۆ (80,000 د.ع) جێبەجێ کرا بۆ یەکەی BOX');

    // Level 3: Custom item price must override any catalog lookup
    const customSaleRes = await fetch(`${API_BASE}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ barcode: 'CUSTOM_TEST', name: 'کاڵای تایبەت', quantity: 2, price: 3500, is_custom: true }],
        payment_method: 'CASH'
      })
    });
    const customSaleData = await customSaleRes.json();
    if (customSaleData.saleId) createdSaleIds.push(customSaleData.saleId);
    assert.strictEqual(customSaleRes.status, 201, 'Custom item checkout should succeed');
    assert.strictEqual(customSaleData.total, '7000', 'Custom item price (3500 * 2 = 7000) must be respected directly');
    console.log('✓ ئەولەویەتی ٣: نرخی دەستیی کاڵای تایبەت (Custom Item: 7,000 د.ع) بێ کێشە پەسەند کرا');

    // Level 4: Cashier Manual Price Override on standard catalog item
    const overrideSaleRes = await fetch(`${API_BASE}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ barcode: `SPEC_SKU_${testSuffix}`, quantity: 1, price: 9500, has_custom_price: true, unit_type: 'PIECE' }],
        payment_method: 'CASH'
      })
    });
    const overrideSaleData = await overrideSaleRes.json();
    if (overrideSaleData.saleId) createdSaleIds.push(overrideSaleData.saleId);
    assert.strictEqual(overrideSaleRes.status, 201, 'Cashier custom price checkout should succeed');
    assert.strictEqual(overrideSaleData.total, '9500', 'Cashier manual overridden price (9500) must override batch and catalog price');
    console.log('✓ ئەولەویەتی ٤: نرخی دیاریکراوی دەستیی کاشێر (9,500 د.ع) زاڵ بوو بەسەر نرخی کەتەلۆگ و باچ');

    // =========================================================================
    // SCENARIO C: Time-Bound and Scheduled Specificity
    // =========================================================================
    console.log('\n--- [Scenario C] داشکاندنی بەرواربەند (Time-Bound & Temporal Specificity) ---');

    // 1. Expired Promotion (Yesterday)
    const [expPromoRes] = await db.query(`
      INSERT INTO Promotions (product_id, discount_type, discount_value, start_date, end_date, is_active)
      VALUES (?, 'PERCENT', 30, DATE_SUB(CURDATE(), INTERVAL 5 DAY), DATE_SUB(CURDATE(), INTERVAL 1 DAY), 1)
    `, [testProductId]);
    createdPromoIds.push(expPromoRes.insertId);

    // 2. Future Scheduled Promotion (Next Week)
    const [schedPromoRes] = await db.query(`
      INSERT INTO Promotions (product_id, discount_type, discount_value, start_date, end_date, is_active)
      VALUES (?, 'PERCENT', 40, DATE_ADD(CURDATE(), INTERVAL 2 DAY), DATE_ADD(CURDATE(), INTERVAL 7 DAY), 1)
    `, [testProductId]);
    createdPromoIds.push(schedPromoRes.insertId);

    // Verify neither expired nor scheduled promotion applies today
    const timeCheckRes = await fetch(`${API_BASE}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ barcode: `SPEC_SKU_${testSuffix}`, quantity: 1, unit_type: 'PIECE' }],
        payment_method: 'CASH'
      })
    });
    const timeCheckData = await timeCheckRes.json();
    if (timeCheckData.saleId) createdSaleIds.push(timeCheckData.saleId);
    assert.strictEqual(timeCheckData.total, '12000', 'Expired and scheduled promotions must NOT apply to current date');
    console.log('✓ ئۆفەری بەسەرچوو (Expired) و ئۆفەری داهاتوو (Scheduled) بە دروستی پشتگوێ خران');

    // 3. Now insert an Active Promotion for Today (25% off 12,000 -> 9,000 IQD)
    const [actPromoRes] = await db.query(`
      INSERT INTO Promotions (product_id, discount_type, discount_value, max_qty_per_sale, start_date, end_date, is_active)
      VALUES (?, 'PERCENT', 25, 2, CURDATE(), CURDATE(), 1)
    `, [testProductId]);
    const activePromoId = actPromoRes.insertId;
    createdPromoIds.push(activePromoId);

    const activePromoSaleRes = await fetch(`${API_BASE}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ barcode: `SPEC_SKU_${testSuffix}`, quantity: 1, unit_type: 'PIECE' }],
        payment_method: 'CASH'
      })
    });
    const activePromoSaleData = await activePromoSaleRes.json();
    if (activePromoSaleData.saleId) createdSaleIds.push(activePromoSaleData.saleId);
    assert.strictEqual(activePromoSaleData.total, '9000', 'Active 25% promo on 12000 must result in 9000 IQD');
    console.log('✓ ئۆفەری چالاکی ئەمڕۆ (25٪ داشکاندن) بە سەرکەوتوویی جێبەجێ بوو: لە 12,000 بووە 9,000 د.ع');

    // Verify Carton/Box sale STILL suppresses the SKU active promotion
    const boxWithPromoRes = await fetch(`${API_BASE}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ barcode: `SPEC_SKU_${testSuffix}`, quantity: 1, unit_type: 'BOX' }],
        payment_method: 'CASH'
      })
    });
    const boxWithPromoData = await boxWithPromoRes.json();
    if (boxWithPromoData.saleId) createdSaleIds.push(boxWithPromoData.saleId);
    assert.strictEqual(boxWithPromoData.total, '80000', 'BOX sale must strictly suppress SKU single-unit promotion');
    console.log('✓ فرۆشتنی کارتۆن (BOX) تەنانەت لە کاتی هەبوونی ئۆفەری دانەشدا نرخی کارتۆن جێبەجێ دەکات');

    // =========================================================================
    // SCENARIO F: Dynamic Quantity Thresholds (max_qty_per_sale boundary)
    // =========================================================================
    console.log('\n--- [Scenario F] سنووری بڕی داشکاندن (max_qty_per_sale Specificity Boundary) ---');
    // Active promo has max_qty_per_sale = 2.
    // Buying 3 units: first 2 at 9,000 IQD, 3rd at regular 12,000 IQD.
    // Total = (2 * 9000) + (1 * 12000) = 18000 + 12000 = 30,000 IQD.
    const qtyTierRes = await fetch(`${API_BASE}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ barcode: `SPEC_SKU_${testSuffix}`, quantity: 3, unit_type: 'PIECE' }],
        payment_method: 'CASH'
      })
    });
    const qtyTierData = await qtyTierRes.json();
    if (qtyTierData.saleId) createdSaleIds.push(qtyTierData.saleId);
    assert.strictEqual(qtyTierData.total, '30000', 'Tiered promo limit (2 @ 9000 + 1 @ 12000) must equal 30000 IQD');
    console.log('✓ ژمێرەری پلەبەندیی بڕ: ٢ دانە بە داشکاندن (9,000) و ١ دانە بە نرخی ئاسایی (12,000) = 30,000 د.ع');

    // =========================================================================
    // SCENARIO A: Overlapping Discounts & Compounding Test
    // =========================================================================
    console.log('\n--- [Scenario A] تاقیکردنەوەی لێککەوتنی داشکاندنەکان (Compounding / Conflict Test) ---');
    // Subtotal with 1 unit = 9,000 IQD (item promo already applied).
    // If cashier also applies cart-level manual discount of 1,000 IQD:
    // Final Total = 9,000 - 1,000 = 8,000 IQD.
    const compoundRes = await fetch(`${API_BASE}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ barcode: `SPEC_SKU_${testSuffix}`, quantity: 1, unit_type: 'PIECE' }],
        discount_amount: 1000,
        payment_method: 'CASH'
      })
    });
    const compoundData = await compoundRes.json();
    if (compoundData.saleId) createdSaleIds.push(compoundData.saleId);
    assert.strictEqual(compoundData.subtotal, '9000', 'Subtotal incorporates line-item promo price');
    assert.strictEqual(compoundData.discount, '1000', 'Manual discount amount is tracked');
    assert.strictEqual(compoundData.total, '8000', 'Total compounds line promo and cart discount (8000 IQD)');
    console.log('✓ سیستەم داشکاندنی کاڵا (Promotion) لەگەڵ داشکاندنی پسووڵە (Cart Discount) کۆدەکاتەوە (Compounded)');

    // =========================================================================
    // SCENARIO D: Returns and Refunds After Discount
    // =========================================================================
    console.log('\n--- [Scenario D] گەڕاندنەوە دوای داشکاندنی لێکدراو (Returns Proportional Scaling) ---');
    // Sale with 2 units: subtotal = 18,000 IQD (each 9,000 IQD).
    // Cart discount = 3,000 IQD. Total paid = 15,000 IQD.
    // Effective price per unit = 15,000 / 2 = 7,500 IQD.
    const saleForReturnRes = await fetch(`${API_BASE}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ barcode: `SPEC_SKU_${testSuffix}`, quantity: 2, unit_type: 'PIECE' }],
        discount_amount: 3000,
        payment_method: 'CASH'
      })
    });
    const saleForReturnData = await saleForReturnRes.json();
    const returnSaleId = saleForReturnData.saleId;
    if (returnSaleId) createdSaleIds.push(returnSaleId);

    // Fetch sale return calculation preview
    const returnPreviewRes = await fetch(`${API_BASE}/returns/sale/${returnSaleId}`);
    const returnPreviewData = await returnPreviewRes.json();
    const returnItem = returnPreviewData.data.items[0];

    // Verify discountRatio = 15000 / 18000 = 0.8333...
    // effective_unit_price = Math.round(9000 * (15000 / 18000)) = 7500 IQD
    assert.strictEqual(returnItem.effective_unit_price, 7500, 'Effective return price must be scaled by discount ratio (7500 IQD)');
    console.log('✓ نرخی گەڕاندنەوەی یەکە بە پێوەرەی ڕێژەی داشکاندن دیاریکرا: 7,500 د.ع لەبری 9,000 د.ع');

    // Execute Partial Return of 1 unit
    const doReturnRes = await fetch(`${API_BASE}/returns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sale_id: returnSaleId,
        product_id: testProductId,
        quantity: 1,
        refund_method: 'CASH',
        reason: 'پشکنینی گەڕاندنەوەی ورد'
      })
    });
    const doReturnData = await doReturnRes.json();
    assert.strictEqual(doReturnData.status, 'SUCCESS');
    assert.strictEqual(doReturnData.refunded_amount, 7500, 'Refunded amount for 1 unit must exactly equal 7500 IQD');
    console.log('✓ گەڕاندنەوەی بەشەکی (١ دانە لە ٢ دانە) بە سەرکەوتوویی بە 7,500 د.ع گەڕێنرایەوە');

    // Execute Final Return of the remaining 1 unit
    const doFinalReturnRes = await fetch(`${API_BASE}/returns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sale_id: returnSaleId,
        product_id: testProductId,
        quantity: 1,
        refund_method: 'CASH',
        reason: 'پشکنینی گەڕاندنەوەی دوا دانە'
      })
    });
    const doFinalReturnData = await doFinalReturnRes.json();
    // Remaining refundable was 15000 - 7500 = 7500.
    assert.strictEqual(doFinalReturnData.refunded_amount, 7500, 'Final unit must absorb exact remaining refundable balance');
    console.log('✓ گەڕاندنەوەی دوا دانە تەواوی باڵانسی ماوەی پسووڵەکەی وەرگرتەوە بەبێ کەموکوڕی');

    // =========================================================================
    // SCENARIO E: Tied Specificity & Frontend-Backend Conflict Probe
    // =========================================================================
    console.log('\n--- [Scenario E] تاقیکردنەوەی دوو ئۆفەری هاوتەریب و ناکۆکی ڕووکار/باکئەند ---');
    // Create Promo A (Older ID, 10% off -> 10,800 IQD)
    const [promoARes] = await db.query(`
      INSERT INTO Promotions (product_id, discount_type, discount_value, start_date, end_date, is_active)
      VALUES (?, 'PERCENT', 10, CURDATE(), CURDATE(), 1)
    `, [testProductId]);
    const promoAId = promoARes.insertId;
    createdPromoIds.push(promoAId);

    // Create Promo B (Newer ID, 50% off -> 6,000 IQD)
    const [promoBRes] = await db.query(`
      INSERT INTO Promotions (product_id, discount_type, discount_value, start_date, end_date, is_active)
      VALUES (?, 'PERCENT', 50, CURDATE(), CURDATE(), 1)
    `, [testProductId]);
    const promoBId = promoBRes.insertId;
    createdPromoIds.push(promoBId);

    // Backend checkout chooses ORDER BY id DESC LIMIT 1 -> Promo B (50% off -> 6000 IQD)
    const tieCheckoutRes = await fetch(`${API_BASE}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ barcode: `SPEC_SKU_${testSuffix}`, quantity: 1, unit_type: 'PIECE' }],
        payment_method: 'CASH'
      })
    });
    const tieCheckoutData = await tieCheckoutRes.json();
    if (tieCheckoutData.saleId) createdSaleIds.push(tieCheckoutData.saleId);
    assert.strictEqual(tieCheckoutData.total, '6000', 'Backend checkout must select the latest created promotion (ID DESC)');
    console.log(`✓ باکئەند ئۆفەری نوێترینی هەڵبژارد (ID ${promoBId} بە ٥٠٪ داشکاندن = 6,000 د.ع)`);

    // Fetch active promotions API (used by Cashier frontend)
    const activePromosApiRes = await fetch(`${API_BASE}/promotions/active`);
    const activePromosApiData = await activePromosApiRes.json();
    const frontendSelectedPromo = activePromosApiData.activeMap[testProductId];

    console.log(`⚠️ پشکنینی ڕووکار: activeMap بۆ ئەم کاڵایە ئۆفەری ID ${frontendSelectedPromo?.id} (داشکاندنی ${frontendSelectedPromo?.discount_value}٪) پیشان دەدات`);
    if (frontendSelectedPromo?.id !== promoBId) {
      console.log('⚡ ئاگاداریی تەلارسازی: ڕووکار و باکئەند ناکۆکن لە دیاریکردنی ئۆفەری هاوتەریب!');
      console.log(`   - ڕووکار پیشانی دەدات: ID ${frontendSelectedPromo?.id} (${frontendSelectedPromo?.discount_value}%)`);
      console.log(`   - باکئەند پارە وەردەگرێت: ID ${promoBId} (50%)`);
    }

    console.log('\n========================================================================');
    console.log('🎉 سەرکەوتوو بوو! هەموو سیناریۆکانی بزوێنەری تایبەتمەندی بە تەواوی تاقیکرانەوە.');
    console.log('========================================================================\n');

  } finally {
    // Robust cleanup honoring foreign keys
    try {
      if (createdPromoIds.length > 0) {
        await db.query('DELETE FROM Promotions WHERE id IN (?)', [createdPromoIds]);
      }
      if (createdSaleIds.length > 0) {
        await db.query('DELETE FROM Returns WHERE sale_id IN (?)', [createdSaleIds]);
        await db.query('DELETE FROM Sale_Item_Batches WHERE sale_id IN (?)', [createdSaleIds]);
        await db.query('DELETE FROM Sale_Items WHERE sale_id IN (?)', [createdSaleIds]);
        await db.query('DELETE FROM Sales WHERE id IN (?)', [createdSaleIds]);
      }
      if (testProductId) {
        await db.query('DELETE FROM Returns WHERE product_id = ?', [testProductId]);
        await db.query('DELETE FROM Sale_Items WHERE product_id = ?', [testProductId]);
        await db.query('DELETE FROM Product_Batches WHERE product_id = ?', [testProductId]);
        await db.query('DELETE FROM Products WHERE id = ?', [testProductId]);
      }
      if (testCustomer) {
        await db.query('DELETE FROM Customer_Debts WHERE customer_id = ?', [testCustomer]);
        await db.query('DELETE FROM Customers WHERE id = ?', [testCustomer]);
      }
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }
  }
}

if (require.main === module) {
  runSpecificityTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ تاقیکردنەوە سەرکەوتوو نەبوو:', err);
      process.exit(1);
    });
}

module.exports = runSpecificityTests;
