import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { useRepository } from '../data/DatabaseProvider';
import { emptyTransactionFilters, filterTransactions, TransactionFilters } from '../data/transactionFilters';
import type { Account, Category, SavedTransaction } from '../data/storage';
import { pkr } from '../sampleData';
import { useTheme } from '../theme';
import { Action, Choice, Field } from '../components/FormControls';
import { Card, EmptyState, Heading, Label } from '../components/Common';
import type { FormKind } from './EntryForm';

export function TransactionsScreen({ rows, accounts, categories, onAdd, onEdit, onChanged }: {
  rows: SavedTransaction[]; accounts: Account[]; categories: Category[];
  onAdd: (kind: FormKind) => void; onEdit: (id: number) => void; onChanged: () => void;
}) {
  const theme = useTheme();
  const repo = useRepository();
  const [filters, setFilters] = useState<TransactionFilters>(emptyTransactionFilters);
  const [expanded, setExpanded] = useState(false);
  const shown = useMemo(() => filterTransactions(rows, filters), [rows, filters]);
  const active = Number(filters.kind !== 'all') + Number(filters.accountId !== null) + Number(filters.categoryId !== null);
  const filtered = active > 0 || filters.query.length > 0;
  const remove = (id: number) => Alert.alert('Delete this transaction?', 'Its effect on balances and spending will be reversed. This cannot be undone without a backup.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => {
      try { repo.deleteEntry(id); onChanged(); } catch { Alert.alert('Could not delete', 'The record was kept because deleting it would create an invalid balance.'); }
    } },
  ]);
  return <>
    <Heading>Money in & out</Heading>
    <View style={{ gap: 8 }}><Action onPress={() => onAdd('income')}>Add income</Action><Action onPress={() => onAdd('transfer')}>Transfer / repay card</Action></View>
    <Field label="Search notes, names or dates" value={filters.query} onChange={query => setFilters(previous => ({ ...previous, query }))} maxLength={200} />
    <Action onPress={() => setExpanded(value => !value)}>{expanded ? 'Hide filters' : 'Show filters'}{active ? ` (${active} active)` : ''}</Action>
    {expanded && <View style={{ gap: 14 }}>
      <Choice label="Transaction type" value={filters.kind} options={[
        { value: 'all', label: 'All types' }, { value: 'expense', label: 'Expenses' }, { value: 'income', label: 'Income' }, { value: 'transfer', label: 'Transfers / repayments' },
      ]} onChange={value => setFilters(previous => ({ ...previous, kind: value as TransactionFilters['kind'], categoryId: value === 'income' || value === 'transfer' ? null : previous.categoryId }))} />
      <Choice label="Account filter" value={String(filters.accountId ?? '')} options={[{ value: '', label: 'All accounts' }, ...accounts.map(account => ({ value: String(account.id), label: account.name }))]} onChange={value => setFilters(previous => ({ ...previous, accountId: value ? Number(value) : null }))} />
      <Label muted>Includes transfers into and out of the selected account.</Label>
      {(filters.kind === 'all' || filters.kind === 'expense') && <>
        <Choice label="Expense category filter" value={String(filters.categoryId ?? '')} options={[{ value: '', label: 'All categories' }, ...categories.map(category => ({ value: String(category.id), label: category.parent_id === null ? category.name : `${categories.find(parent => parent.id === category.parent_id)?.name} / ${category.name}` }))]} onChange={value => setFilters(previous => ({ ...previous, categoryId: value ? Number(value) : null }))} />
        <Label muted>Choosing a category shows expenses only. A parent includes its subcategories.</Label>
      </>}
    </View>}
    {filtered && <Action onPress={() => setFilters({ ...emptyTransactionFilters })}>Clear filters</Action>}
    <Label muted>Showing {shown.length} of {rows.length} transactions in the selected month. Filters do not change balances or budgets.</Label>
    {shown.length ? shown.map(item => <Card key={item.id}>
      <Label style={{ fontWeight: '600', fontSize: 17 }}>{item.kind === 'expense' ? item.category : item.kind === 'income' ? item.source : 'Transfer'}</Label>
      <Label muted>{item.date} · {item.account}{item.destination ? ` → ${item.destination}` : ''}{item.card ? ` · ${item.card}` : ''}</Label>
      {!!item.note && <Label>{item.note}</Label>}
      <Label style={{ fontWeight: '600', fontSize: 17, color: item.kind === 'income' ? theme.income : item.kind === 'expense' ? theme.expense : theme.text }}>{item.kind === 'income' ? '+' : item.kind === 'expense' ? '−' : '↔'} {pkr(item.amount)}</Label>
      <View style={{ flexDirection: 'row', gap: 8 }}><Action onPress={() => onEdit(item.id)}>Edit</Action><Action onPress={() => remove(item.id)}>Delete</Action></View>
    </Card>) : <EmptyState title={filtered && rows.length ? 'No matching transactions' : 'No transactions this month'} detail={filtered && rows.length ? 'Try another search, adjust the filters, or clear them to see all entries for this month.' : 'Choose another month or use + to add an expense. Filters search the selected month only.'} />}
  </>;
}
