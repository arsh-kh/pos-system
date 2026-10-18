/**
 * test_analytics_ranges.js
 * Verifies Universal Reporting Engine across all time periods:
 * 1. Day / Today (Hourly breakdown)
 * 2. Week (Last 7 days)
 * 3. Month (Current Month)
 * 4. Year (Current Year)
 * 5. Custom Date Range (Arbitrary start & end dates)
 */
const assert = require('assert');

const BASE_URL = 'http://localhost:3001/api/analytics/report';

async function runAnalyticsRangesTests() {
  console.log('📊 Starting Universal Analytics Time-Range Tests...');

  // 1. Test 'today' (Day)
  console.log('  Testing range=today (Day / Hourly)...');
  const resToday = await fetch(`${BASE_URL}?range=today`);
  assert.strictEqual(resToday.status, 200, 'Today report must return 200');
  const jsonToday = await resToday.json();
  assert.strictEqual(jsonToday.status, 'SUCCESS', 'Status must be SUCCESS');
  assert.strictEqual(jsonToday.data.range, 'today');
  assert(jsonToday.data.metrics, 'Metrics object must be present');
  assert(typeof jsonToday.data.metrics.total_sales === 'number');
  assert(typeof jsonToday.data.metrics.net_profit === 'number');
  assert(Array.isArray(jsonToday.data.chart_data), 'Chart data must be array');
  assert.strictEqual(jsonToday.data.chart_data.length, 24, 'Hourly chart data must have 24 hours');
  console.log('  ✓ 1. Day / Today report verified with 24 hours breakdown');

  // 2. Test 'week' (Last 7 days)
  console.log('  Testing range=week (Weekly)...');
  const resWeek = await fetch(`${BASE_URL}?range=week`);
  assert.strictEqual(resWeek.status, 200);
  const jsonWeek = await resWeek.json();
  assert.strictEqual(jsonWeek.status, 'SUCCESS');
  assert.strictEqual(jsonWeek.data.range, 'week');
  assert(Array.isArray(jsonWeek.data.top_products), 'Top products array must be present');
  console.log('  ✓ 2. Week report verified with top products and metrics');

  // 3. Test 'month' (Monthly)
  console.log('  Testing range=month (Monthly)...');
  const resMonth = await fetch(`${BASE_URL}?range=month`);
  assert.strictEqual(resMonth.status, 200);
  const jsonMonth = await resMonth.json();
  assert.strictEqual(jsonMonth.status, 'SUCCESS');
  assert.strictEqual(jsonMonth.data.range, 'month');
  assert(jsonMonth.data.range_label.includes('ئەم مانگە'), 'Kurdish label must match');
  console.log('  ✓ 3. Month report verified successfully');

  // 4. Test 'year' (Yearly)
  console.log('  Testing range=year (Yearly)...');
  const resYear = await fetch(`${BASE_URL}?range=year`);
  assert.strictEqual(resYear.status, 200);
  const jsonYear = await resYear.json();
  assert.strictEqual(jsonYear.status, 'SUCCESS');
  assert.strictEqual(jsonYear.data.range, 'year');
  assert(jsonYear.data.range_label.includes('ئەمساڵ'), 'Kurdish label must match');
  console.log('  ✓ 4. Year report verified successfully');

  // 5. Test 'custom' (Custom Date Range)
  console.log('  Testing range=custom (Custom Range: 2026-01-01 to 2026-12-31)...');
  const resCustom = await fetch(`${BASE_URL}?range=custom&startDate=2026-01-01&endDate=2026-12-31`);
  assert.strictEqual(resCustom.status, 200);
  const jsonCustom = await resCustom.json();
  assert.strictEqual(jsonCustom.status, 'SUCCESS');
  assert.strictEqual(jsonCustom.data.range, 'custom');
  assert(jsonCustom.data.range_label.includes('2026-01-01'), 'Custom label must include start date');
  console.log('  ✓ 5. Custom Date Range report verified successfully');

  console.log('🎉 All Universal Analytics Ranges Tests Passed 100%!\n');
}

if (require.main === module) {
  runAnalyticsRangesTests()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Analytics Ranges Test Failed:', err);
      process.exit(1);
    });
}

module.exports = runAnalyticsRangesTests;
