export type Budget = { name: string; planned: number; spent: number; color: string };
export type Transaction = { name: string; detail: string; amount: number; kind: 'income' | 'expense' };

// Preview records only. Amounts are integer paisa, not floating-point rupees.
export const sampleBudgets: Budget[] = [
  { name: 'Food', planned: 3000000, spent: 1250000, color: '#3B9D83' },
  { name: 'Transport', planned: 1500000, spent: 600000, color: '#E8AD51' },
  { name: 'Shopping', planned: 1000000, spent: 450000, color: '#8584D8' },
];
export const sampleTransactions: Transaction[] = [
  { name: 'Salary', detail: 'Income · Bank account', amount: 15000000, kind: 'income' },
  { name: 'Groceries', detail: 'Food · Debit card', amount: 1250000, kind: 'expense' },
  { name: 'Fuel', detail: 'Transport · Bank account', amount: 600000, kind: 'expense' },
  { name: 'Clothes', detail: 'Shopping · Credit card', amount: 450000, kind: 'expense' },
];
export function pkr(paisa: number): string {
  if (!Number.isSafeInteger(paisa)) throw new Error('Money must be safe integer paisa');
  const sign = paisa < 0 ? '-' : '';
  const value = Math.abs(paisa);
  const rupees = Math.floor(value / 100).toLocaleString('en-US');
  return `PKR ${sign}${rupees}.${String(value % 100).padStart(2, '0')}`;
}
// A month is an integer offset; December -> January needs no date parsing or time zones.
export function currentMonth(date = new Date()): number { return date.getFullYear() * 12 + date.getMonth(); }
export function monthLabel(month: number): string {
  return new Date(Math.floor(month / 12), month % 12, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
export function budgetsForMonth(month: number, previewMonth: number): Budget[] {
  return month === previewMonth ? sampleBudgets : [];
}
export function spendingTotal(budgets: Budget[]): number { return budgets.reduce((sum, b) => sum + b.spent, 0); }
export function pieSlices(budgets: Budget[]) {
  const positive = budgets.filter(b => b.spent > 0);
  const total = spendingTotal(positive);
  let start = -90;
  return positive.map(budget => {
    const sweep = budget.spent / total * 360;
    const slice = { ...budget, start, sweep };
    start += sweep;
    return slice;
  });
}
