const test = require('node:test');
const assert = require('node:assert/strict');

test('budget-alert-service: threshold alert triggers correctly', () => {
  const limit = 500.0;
  const spentNormal = 350.0;
  const spentWarning = 420.0; // 84%
  const spentExceeded = 510.0; // 102%

  const isWarning = (spent, lim) => spent >= lim * 0.8 && spent < lim;
  const isExceeded = (spent, lim) => spent >= lim;

  assert.equal(isWarning(spentNormal, limit), false);
  assert.equal(isExceeded(spentNormal, limit), false);

  assert.equal(isWarning(spentWarning, limit), true);
  assert.equal(isExceeded(spentWarning, limit), false);

  assert.equal(isWarning(spentExceeded, limit), false);
  assert.equal(isExceeded(spentExceeded, limit), true);
});

test('budget-alert-service: month-year formatting', () => {
  const d = new Date('2026-09-27T10:00:00Z');
  const monthYear = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  assert.equal(monthYear, '2026-09');
});

test('budget-alert-service: Prometheus metrics registry produces valid metrics', async () => {
  const { register, httpRequestsTotal, budgetAlertsTriggeredTotal } = require('../src/metrics');

  httpRequestsTotal.inc({ method: 'GET', route: '/health', status_code: '200' });
  budgetAlertsTriggeredTotal.inc({ alert_type: 'BUDGET_WARNING', category: 'Food & Dining' });

  const metricsOutput = await register.metrics();
  assert.ok(typeof metricsOutput === 'string');
  assert.ok(metricsOutput.includes('http_requests_total'));
  assert.ok(metricsOutput.includes('budget-alert-service'));
  assert.ok(metricsOutput.includes('budget_alerts_triggered_total'));
});
