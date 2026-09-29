import test from 'node:test';
import assert from 'node:assert/strict';
import { pkr, currentMonth, monthLabel, budgetsForMonth, sampleBudgets, sampleTransactions, spendingTotal, pieSlices } from '../src/sampleData.ts';

test('money preserves paisa, signs and safe numeric limits', () => {
  assert.equal(pkr(1234567), 'PKR 12,345.67');
  assert.equal(pkr(-1), 'PKR -0.01');
  assert.equal(pkr(0), 'PKR 0.00');
  assert.throws(() => pkr(1.5));
  assert.throws(() => pkr(Number.MAX_SAFE_INTEGER + 1));
});
test('month navigation crosses year boundaries and isolates preview data', () => {
  const december = currentMonth(new Date(2026, 11, 15));
  assert.equal(monthLabel(december + 1), 'January 2027');
  assert.equal(monthLabel(december - 11), 'January 2026');
  assert.deepEqual(budgetsForMonth(december + 1, december), []);
  assert.equal(spendingTotal(budgetsForMonth(december, december)), 2300000);
});
test('dashboard spending reconciles with expense transactions only', () => {
  const expenses = sampleTransactions.filter(t => t.kind === 'expense').reduce((sum, t) => sum + t.amount, 0);
  assert.equal(spendingTotal(sampleBudgets), expenses);
});
test('pie handles empty, zero and single-category data without invalid geometry', () => {
  assert.deepEqual(pieSlices([]), []);
  assert.deepEqual(pieSlices([{ ...sampleBudgets[0], spent: 0 }]), []);
  assert.equal(pieSlices([sampleBudgets[0]])[0].sweep, 360);
  const slices = pieSlices(sampleBudgets);
  assert.ok(Math.abs(slices.reduce((sum, s) => sum + s.sweep, 0) - 360) < 0.00001);
  assert.ok(slices.every(s => Number.isFinite(s.start) && Number.isFinite(s.sweep)));
});
