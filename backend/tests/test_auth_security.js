/**
 * test_auth_security.js
 * Verifies backend password change endpoint, validation, and login authentication.
 */
const assert = require('assert');
const axios = require('axios');
const db = require('../db');
const bcrypt = require('bcryptjs');

const BASE_URL = 'http://localhost:3001/api/auth';

async function runAuthSecurityTests() {
  console.log('🧪 Starting Auth & Password Security Tests...');

  // Ensure test user 'admin' exists with known password
  const testUser = 'admin';
  const initialPassword = 'admin123';
  const temporaryPassword = 'newSecureAdminPass2026';

  const [existing] = await db.query('SELECT * FROM Users WHERE username = ?', [testUser]);
  if (existing.length === 0) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(initialPassword, salt);
    await db.query('INSERT INTO Users (username, password, role) VALUES (?, ?, ?)', [testUser, hash, 'ADMIN']);
  } else {
    // Reset to initialPassword to ensure baseline
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(initialPassword, salt);
    await db.query('UPDATE Users SET password = ? WHERE username = ?', [hash, testUser]);
  }

  // 1. Test missing fields
  try {
    await axios.post(`${BASE_URL}/change-password`, {
      username: testUser,
      oldPassword: ''
    });
    assert.fail('Should have failed for missing fields');
  } catch (err) {
    assert.strictEqual(err.response?.status, 400, 'Expected 400 for missing fields');
    console.log('  ✅ Validation: Empty fields rejected (400)');
  }

  // 2. Test short password (< 4 chars)
  try {
    await axios.post(`${BASE_URL}/change-password`, {
      username: testUser,
      oldPassword: initialPassword,
      newPassword: '12'
    });
    assert.fail('Should have failed for short password');
  } catch (err) {
    assert.strictEqual(err.response?.status, 400, 'Expected 400 for short password');
    console.log('  ✅ Validation: Short password rejected (400)');
  }

  // 3. Test wrong old password
  try {
    await axios.post(`${BASE_URL}/change-password`, {
      username: testUser,
      oldPassword: 'WRONG_OLD_PASSWORD',
      newPassword: temporaryPassword
    });
    assert.fail('Should have failed for wrong old password');
  } catch (err) {
    assert.strictEqual(err.response?.status, 401, 'Expected 401 for wrong old password');
    console.log('  ✅ Security: Wrong old password rejected (401)');
  }

  // 4. Test successful password change
  const changeRes = await axios.post(`${BASE_URL}/change-password`, {
    username: testUser,
    oldPassword: initialPassword,
    newPassword: temporaryPassword
  });
  assert.strictEqual(changeRes.status, 200);
  assert.strictEqual(changeRes.data?.status, 'SUCCESS');
  console.log('  ✅ Execution: Password successfully changed');

  // 5. Test login with old password fails
  try {
    await axios.post(`${BASE_URL}/login`, {
      username: testUser,
      password: initialPassword
    });
    assert.fail('Old password should no longer work');
  } catch (err) {
    assert.strictEqual(err.response?.status, 401, 'Old password rejected');
    console.log('  ✅ Verification: Old password revoked (401)');
  }

  // 6. Test login with new password succeeds
  const loginRes = await axios.post(`${BASE_URL}/login`, {
    username: testUser,
    password: temporaryPassword
  });
  assert.strictEqual(loginRes.status, 200);
  assert.strictEqual(loginRes.data?.status, 'SUCCESS');
  assert.ok(loginRes.data?.token, 'Login returned valid JWT token');
  console.log('  ✅ Verification: Login with new password succeeded (JWT generated)');

  // 7. Cleanup: Revert back to initialPassword
  const revertRes = await axios.post(`${BASE_URL}/change-password`, {
    username: testUser,
    oldPassword: temporaryPassword,
    newPassword: initialPassword
  });
  assert.strictEqual(revertRes.status, 200);
  console.log('  ✅ Teardown: Password reverted back cleanly to baseline');

  console.log('🎉 All Auth & Password Security Tests Passed!\n');
}

if (require.main === module) {
  runAuthSecurityTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Auth Security Test Failed:', err.message);
      process.exit(1);
    });
}

module.exports = runAuthSecurityTests;
