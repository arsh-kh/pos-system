require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const assert = require('assert');
const db = require('../db');
const permissionsController = require('../controllers/permissions');

// Mock Express req/res
function createMockRes() {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
  return res;
}

async function runTests() {
  console.log('🧪 دەستپێکردنی تاقیکردنەوەی دەسەڵاتەکانی کاشێر (Cashier Permissions Tests)...');

  // 1. Test GET /api/permissions/cashier
  console.log('  [1/3] تاقیکردنەوەی هێنانی هەموو دەسەڵاتەکان (GET permissions)...');
  const getReq = { headers: {} };
  const getRes = createMockRes();
  await permissionsController.getCashierPermissions(getReq, getRes);

  assert.strictEqual(getRes.statusCode, 200, 'Status should be 200');
  assert.strictEqual(getRes.data.status, 'SUCCESS', 'Response status should be SUCCESS');
  assert(Array.isArray(getRes.data.data.permissions), 'Permissions should be an array');
  assert(getRes.data.data.permissions.length >= 15, 'Should contain at least 15 default permissions');
  assert(typeof getRes.data.data.map === 'object', 'Map should be an object');
  assert('pos_cashier' in getRes.data.data.map, 'pos_cashier key should exist');
  assert('allow_manual_discount' in getRes.data.data.map, 'allow_manual_discount key should exist');
  console.log('  ✓ سەرکەوتوو! کۆی گشتی', getRes.data.data.permissions.length, 'دەسەڵات دۆزرانەوە.');

  // 2. Test PUT /api/permissions/cashier update
  console.log('  [2/3] تاقیکردنەوەی نوێکردنەوەی دەسەڵاتەکان لەلایەن ئەدمینەوە (PUT update)...');
  const updateReq = {
    headers: { 'x-user-role': 'ADMIN', 'x-user-name': 'admin' },
    body: {
      updates: {
        allow_custom_price: true,
        inv_promotions: true
      }
    }
  };
  const updateRes = createMockRes();
  await permissionsController.updateCashierPermissions(updateReq, updateRes);

  assert.strictEqual(updateRes.statusCode, 200, 'Status should be 200');
  assert.strictEqual(updateRes.data.status, 'SUCCESS', 'Response status should be SUCCESS');
  assert.strictEqual(updateRes.data.data.map.allow_custom_price, true, 'allow_custom_price should now be true');
  assert.strictEqual(updateRes.data.data.map.inv_promotions, true, 'inv_promotions should now be true');
  console.log('  ✓ سەرکەوتوو! دەسەڵاتەکان نوێکرانەوە.');

  // 3. Test Audit Log Entry was written
  console.log('  [3/3] پشکنینی تۆمارکردنی چالاکییەکە لەناو AuditLogs...');
  const [logs] = await db.query(
    "SELECT * FROM Audit_Logs WHERE entity_name = 'Cashier_Permissions' ORDER BY id DESC LIMIT 1"
  );
  assert(logs.length > 0, 'Audit log entry should exist for Cashier_Permissions');
  assert(logs[0].details.includes('allow_custom_price'), 'Log details should mention changed keys');
  console.log('  ✓ سەرکەوتوو! چالاکییەکە لە AuditLogs تۆمار کرا: ', logs[0].details);

  // Clean reset
  await db.query("UPDATE Cashier_Permissions SET is_enabled = 0 WHERE permission_key IN ('allow_custom_price', 'inv_promotions')");

  console.log('🎉 سەرجەم تاقیکردنەوەکانی دەسەڵاتی کاشێر بە سەرکەوتوویی تێپەڕین!\n');
  if (require.main === module) process.exit(0);
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('❌ هەڵە لە تاقیکردنەوە:', err);
    process.exit(1);
  });
}

module.exports = runTests;
