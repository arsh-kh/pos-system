const assert = require('assert');

async function run() {
  console.log('Testing src/utils/dateFormatter.js...');
  const { formatDate, formatDateTime, formatTime, formatCurrency, formatRelativeDate } = await import('../../src/utils/dateFormatter.js');

  // 1. formatDate tests
  assert.strictEqual(formatDate('2026-10-18'), '18/10/2026');
  assert.strictEqual(formatDate('2026-01-05'), '05/01/2026');
  assert.strictEqual(formatDate('2026/05/22'), '22/05/2026');
  assert.strictEqual(formatDate(new Date(2026, 9, 18)), '18/10/2026');
  assert.strictEqual(formatDate(null), '-');
  assert.strictEqual(formatDate(''), '-');
  assert.strictEqual(formatDate(undefined), '-');

  // 2. formatDateTime tests
  const dt = new Date(2026, 9, 18, 14, 30);
  const dtFormatted = formatDateTime(dt);
  assert(dtFormatted.startsWith('18/10/2026'), 'Date part must be DD/MM/YYYY');
  assert(dtFormatted.includes('14:30'), 'Time part must be 14:30');

  // 3. formatCurrency tests
  assert.strictEqual(formatCurrency(0), '0 د.ع');
  assert.strictEqual(formatCurrency(25000), '25,000 د.ع');
  assert.strictEqual(formatCurrency('1250000'), '1,250,000 د.ع');
  assert.strictEqual(formatCurrency(null), '0 د.ع');

  // 4. formatRelativeDate tests
  assert.strictEqual(formatRelativeDate(new Date()), 'ئەمڕۆ');

  console.log('✓ All dateFormatter tests PASSED!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
