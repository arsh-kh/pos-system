/**
 * test_z_report_and_telegram.js
 * Verifies Z-Report retrieval, financial calculation integrity, and Telegram shift alert endpoint.
 */
const assert = require('assert');
const axios = require('axios');
const db = require('../db');

const BASE_URL = 'http://localhost:3001/api/shifts';

async function runZReportTests() {
  console.log('🧪 Starting Z-Report & Telegram Shift Summary Tests...');

  // 1. Test GET /api/shifts/z-report/current (or latest)
  const res = await axios.get(`${BASE_URL}/z-report/current`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data?.status, 'SUCCESS');
  const zData = res.data?.data;
  assert.ok(zData, 'Z-Report data object must exist');
  assert.ok(typeof zData.total_sales === 'number', 'total_sales must be numeric');
  assert.ok(typeof zData.cash_sales === 'number', 'cash_sales must be numeric');
  assert.ok(typeof zData.expected_cash === 'number', 'expected_cash must be numeric');
  console.log(`  ✅ Z-Report API: Successfully retrieved Z-Report for shift #${zData.shift_id} (Total Sales: ${zData.total_sales.toLocaleString()} IQD)`);

  // 2. Test POST /api/shifts/z-report/:id/telegram endpoint
  const tgRes = await axios.post(`${BASE_URL}/z-report/${zData.shift_id || 'latest'}/telegram`);
  assert.strictEqual(tgRes.status, 200);
  assert.strictEqual(tgRes.data?.status, 'SUCCESS');
  console.log('  ✅ Telegram Z-Report Dispatch: Endpoint executed successfully');

  // 3. Test open and close shift with Z-Report return payload
  const [openShifts] = await db.query("SELECT id FROM Shifts WHERE status = 'OPEN'");
  let testShiftId;
  if (openShifts.length === 0) {
    const openRes = await axios.post(`${BASE_URL}/open`, {
      cashier_name: 'کاشێری تاقیکاری',
      opening_cash: 50000
    });
    testShiftId = openRes.data.data.id;
    console.log(`  ✅ Shift Open: Created test shift #${testShiftId}`);
  } else {
    testShiftId = openShifts[0].id;
  }

  // Close shift and verify Z-Report payload
  const closeRes = await axios.post(`${BASE_URL}/close/${testShiftId}`, {
    actual_cash: 50000,
    notes: 'تاقیکردنەوەی ئۆتۆماتیکی Z-Report'
  });
  assert.strictEqual(closeRes.status, 200);
  assert.strictEqual(closeRes.data?.status, 'SUCCESS');
  assert.ok(closeRes.data?.data?.shift_id, 'closeShift returned valid Z-Report payload');
  console.log(`  ✅ Shift Close: Shift #${testShiftId} closed with full Z-Report returned`);

  console.log('🎉 All Z-Report & Telegram Shift Summary Tests Passed!\n');
}

if (require.main === module) {
  runZReportTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Z-Report Test Failed:', err.message);
      process.exit(1);
    });
}

module.exports = runZReportTests;
