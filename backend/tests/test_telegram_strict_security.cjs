const db = require('../db');
const { handleIncomingBotCommand } = require('../services/telegramNightlyScheduler');

async function testTelegramSecurity() {
  console.log('=== TEST: TELEGRAM STRICT SECURITY VERIFICATION ===');

  const strangerChatId = '999999999';
  const strangerName = 'HackerStranger';

  try {
    // Clean any previous test data
    await db.query('DELETE FROM Telegram_Recipients WHERE chat_id = ?', [strangerChatId]);

    // 1. Verify stranger cannot run /today or /backup
    console.log('\n--- 1. Testing unauthorized command rejection ---');
    await handleIncomingBotCommand(strangerChatId, '/today', strangerName);
    
    // Verify stranger was NOT added to Telegram_Recipients
    const [rec1] = await db.query('SELECT * FROM Telegram_Recipients WHERE chat_id = ?', [strangerChatId]);
    if (rec1.length > 0) {
      throw new Error('SECURITY BREACH: Stranger was auto-registered into Telegram_Recipients!');
    }
    console.log('✓ Stranger was NOT registered into Telegram_Recipients.');

    // 2. Testing wrong PIN rejection
    console.log('\n--- 2. Testing wrong PIN rejection ---');
    await handleIncomingBotCommand(strangerChatId, '/pair 000000', strangerName);
    const [rec2] = await db.query('SELECT * FROM Telegram_Recipients WHERE chat_id = ?', [strangerChatId]);
    if (rec2.length > 0) {
      throw new Error('SECURITY BREACH: Stranger was registered with wrong PIN!');
    }
    console.log('✓ Stranger was rejected with wrong PIN.');

    // 3. Testing correct PIN pairing
    console.log('\n--- 3. Testing correct PIN pairing ---');
    const [settings] = await db.query('SELECT security_pin FROM telegram_backup_settings WHERE id = 1');
    const validPin = settings[0].security_pin;
    console.log('Current valid PIN:', validPin);

    await handleIncomingBotCommand(strangerChatId, `/pair ${validPin}`, strangerName);
    const [rec3] = await db.query('SELECT * FROM Telegram_Recipients WHERE chat_id = ?', [strangerChatId]);
    if (rec3.length === 0 || !rec3[0].is_active) {
      throw new Error('Pairing with valid PIN failed!');
    }
    console.log('✓ User paired successfully with valid PIN.');

    // 4. Clean up test recipient
    await db.query('DELETE FROM Telegram_Recipients WHERE chat_id = ?', [strangerChatId]);
    console.log('✓ Cleaned up test recipient.');

    console.log('\n=== ALL TELEGRAM SECURITY TESTS PASSED 100%! ===');
  } finally {
    await db.query('DELETE FROM Telegram_Recipients WHERE chat_id = ?', [strangerChatId]).catch(() => {});
  }
}

testTelegramSecurity().then(() => process.exit(0)).catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
