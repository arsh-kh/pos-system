const assert = require('assert');
const axios = require('axios');
const db = require('../db');

const BASE_URL = 'http://localhost:3001/api';

async function runTest() {
  console.log('🧪 دەستپێکردنی تاقیکردنەوەی چەندین کاشێر و ئۆدیت لۆگی سەردەمی (Multi-Cashier & Audit Logs)...');

  const adminHeaders = {
    'x-user-role': 'ADMIN',
    'x-user-name': 'admin'
  };

  // 1. Get Cashiers List
  console.log('  1. پشکنینی لیستی کاشێرەکان GET /api/users/cashiers...');
  const res1 = await axios.get(`${BASE_URL}/users/cashiers`);
  assert.strictEqual(res1.data.status, 'SUCCESS');
  assert(Array.isArray(res1.data.data), 'Data should be an array of cashiers');
  assert(res1.data.data.length >= 2, 'Should have at least 2 cashiers (cashier and cashier2)');
  console.log(`     ✓ دۆزرایەوە: ${res1.data.data.length} کاشێری چالاک`);

  // 2. Create a new Cashier
  const testUsername = `cashier_test_${Date.now().toString().slice(-4)}`;
  console.log(`  2. دروستکردنی کاشێری نوێ: ${testUsername}...`);
  const res2 = await axios.post(`${BASE_URL}/users/cashiers`, {
    username: testUsername,
    full_name: 'کاشێری تاقیگە',
    password: 'securePassword123'
  }, { headers: adminHeaders });

  assert.strictEqual(res2.data.status, 'SUCCESS');
  const createdId = res2.data.data.id;
  assert(createdId > 0, 'New cashier ID should be valid');
  console.log(`     ✓ کاشێری نوێ بە ئایدی ${createdId} دروستکرا.`);

  // 3. Update the Cashier (Change password and name)
  console.log('  3. نوێکردنەوەی زانیارییەکانی کاشێر و گۆڕینی وشەی نهێنی...');
  const res3 = await axios.put(`${BASE_URL}/users/cashiers/${createdId}`, {
    full_name: 'کاشێری ئەزموونی نوێکراوە',
    password: 'newPassword456'
  }, { headers: adminHeaders });
  assert.strictEqual(res3.data.status, 'SUCCESS');
  console.log('     ✓ وشەی نهێنی و ناوی کاشێر بە سەرکەوتوویی نوێکرایەوە.');

  // 4. Test Login with newly updated credentials
  console.log('  4. تاقیکردنەوەی چوونەژوورەوەی ڕاستەقینە بە وشەی نهێنی نوێ...');
  const resLogin = await axios.post(`${BASE_URL}/auth/login`, {
    username: testUsername,
    password: 'newPassword456'
  });
  assert.strictEqual(resLogin.data.status, 'SUCCESS');
  assert(resLogin.data.token, 'Should return valid JWT token');
  assert.strictEqual(resLogin.data.user.username, testUsername);
  assert.strictEqual(resLogin.data.user.role, 'CASHIER');
  console.log(`     ✓ چوونەژوورەوە سەرکەوتوو بوو بۆ: ${resLogin.data.user.full_name}`);

  // 5. Test Audit Log API with Presets (today, last_7_days)
  console.log('  5. پشکنینی تۆماری چاودێری و فلتەر بەپێی ڕۆژ (preset=today)...');
  const resAuditToday = await axios.get(`${BASE_URL}/audit-logs?preset=today&search=${testUsername}`);
  assert.strictEqual(resAuditToday.data.status, 'SUCCESS');
  assert(resAuditToday.data.data.length > 0, 'Should find audit logs created today for the new cashier');
  const actionTypes = resAuditToday.data.data.map(l => l.action_type);
  assert(actionTypes.includes('USER_CREATE'), 'Audit should record USER_CREATE');
  assert(actionTypes.includes('LOGIN_SUCCESS'), 'Audit should record LOGIN_SUCCESS');
  console.log(`     ✓ بە سەرکەوتوویی دۆزرایەوە: ${resAuditToday.data.data.length} لۆگی ئەمڕۆ بە فلتەری preset=today`);

  // 6. Test MySQL Trigger on Products (Price Change Trigger)
  console.log('  6. پشکنینی ترایگەری ڕاستەقینەی داتابەیس (MySQL Trigger: trg_products_after_update)...');
  // Get an existing product
  const [prods] = await db.query('SELECT id, name, selling_price, cost_price FROM Products LIMIT 1');
  if (prods.length > 0) {
    const p = prods[0];
    const originalPrice = p.selling_price;
    const dummyNewPrice = Number(originalPrice) + 250;

    // Direct database update to verify trigger fires automatically
    await db.query('UPDATE Products SET selling_price = ? WHERE id = ?', [dummyNewPrice, p.id]);

    // Check Audit_Logs for trigger-generated entry
    const [triggerLogs] = await db.query(`
      SELECT * FROM Audit_Logs 
      WHERE entity_name = 'Products' AND entity_id = ? AND action_type = 'PRICE_CHANGE' 
      ORDER BY id DESC LIMIT 1
    `, [p.id]);

    assert(triggerLogs.length > 0, 'Trigger must insert an audit log on price update');
    assert.strictEqual(triggerLogs[0].username, 'سیستەم (Trigger)');
    console.log(`     ✓ ترایگەری داتابەیس بە سەرکەوتوویی دەستکاریکردنی نرخی تۆمارکرد: ${triggerLogs[0].details}`);

    // Restore original price
    await db.query('UPDATE Products SET selling_price = ? WHERE id = ?', [originalPrice, p.id]);
  }

  // 7. Delete Test Cashier and verify cleanup
  console.log('  7. سڕینەوەی کاشێری تێست و پشتڕاستکردنەوەی لۆگی سڕینەوە...');
  const resDel = await axios.delete(`${BASE_URL}/users/cashiers/${createdId}`, { headers: adminHeaders });
  assert.strictEqual(resDel.data.status, 'SUCCESS');

  const [delLogs] = await db.query(`
    SELECT * FROM Audit_Logs 
    WHERE entity_name = 'Users' AND entity_id = ? AND action_type = 'USER_DELETE'
  `, [createdId]);
  assert(delLogs.length > 0, 'Audit must record USER_DELETE');
  console.log('     ✓ کاشێر سڕایەوە و لۆگی USER_DELETE بە تەواوی تۆمارکرا.');

  console.log('🎉 هەموو پشکنینەکانی چەندین کاشێر و ئۆدیت لۆگ و ترایگەرەکان ١٠٠٪ سەرکەوتوون!');
  return true;
}

if (require.main === module) {
  runTest()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ تاقیکردنەوە سەرکەوتوو نەبوو:', err.message);
      process.exit(1);
    });
}

module.exports = { runTest };
