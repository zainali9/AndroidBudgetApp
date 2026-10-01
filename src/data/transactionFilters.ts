import type { SavedTransaction } from './storage';

export type TransactionFilters = {
  query: string;
  kind: 'all' | SavedTransaction['kind'];
  accountId: number | null;
  categoryId: number | null;
};
export const emptyTransactionFilters: TransactionFilters = { query: '', kind: 'all', accountId: null, categoryId: null };
const normalize = (text: string) => text.normalize('NFKC').toLowerCase();

// Filters only choose visible rows. They never change the ledger or its ordering.
export function filterTransactions(rows: SavedTransaction[], filters: TransactionFilters): SavedTransaction[] {
  const words = normalize(filters.query).trim().split(/\s+/).filter(Boolean);
  return rows.filter(row => {
    if (filters.kind !== 'all' && row.kind !== filters.kind) return false;
    if (filters.accountId !== null && row.accountId !== filters.accountId && row.destinationId !== filters.accountId) return false;
    if (filters.categoryId !== null && (row.kind !== 'expense' || (row.categoryId !== filters.categoryId && row.categoryParentId !== filters.categoryId))) return false;
    const text = normalize([row.note, row.account, row.destination, row.category, row.source, row.card, row.date].filter(Boolean).join(' '));
    return words.every(word => text.includes(word));
  });
}
