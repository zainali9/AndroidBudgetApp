import { Alert, View } from 'react-native';
import { Budget, pkr, spendingTotal } from '../sampleData';
import { Account, Category, DebitCard, IncomeSource, SavedTransaction } from '../data/storage';
import { useTheme } from '../theme';
import { Card, EmptyState, Heading, InfoRow, Label, Tab } from '../components/Common';
import { Action } from '../components/FormControls';
import { BudgetProgress } from '../components/BudgetProgress';
import { BackupControls } from '../components/BackupControls';
import { useRepository } from '../data/DatabaseProvider';
import { ExpensePieChart } from '../components/ExpensePieChart';
import { FormKind } from './EntryForm';

export type ScreenData = {
  accounts: (Account & { balance: number })[]; categories: Category[]; cards: DebitCard[];
  sources: IncomeSource[]; transactions: SavedTransaction[]; spending: Budget[]; plans: Budget[];
};
export function BudgetScreens({ tab, data, onAdd, onEdit, onChanged, onPlan, onEditCategory }: { onPlan: () => void; onEditCategory: (category: Category) => void; tab: Tab; data: ScreenData; onAdd: (kind: FormKind) => void; onEdit: (id: number) => void; onChanged: () => void }) {
  const theme = useTheme();
  const repo = useRepository();
  const remove = (id: number) => Alert.alert('Delete this transaction?', 'Its effect on balances and spending will be reversed. This cannot be undone without a backup.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => {
      try { repo.deleteEntry(id); onChanged(); } catch { Alert.alert('Could not delete', 'The record was kept because deleting it would create an invalid balance.'); }
    } },
  ]);
  if (tab === 'Home') return <>
    <Heading>Your month at a glance</Heading>
    <ExpensePieChart budgets={data.spending} />
    <Card tinted><Label>Total expenses</Label><Label style={{ fontSize: 28, lineHeight: 36, fontWeight: '700' }}>{pkr(spendingTotal(data.spending))}</Label></Card>
    {!data.accounts.length && <Card><Heading>Start with your accounts</Heading><Label muted>Add cash, a bank account or a credit card, then create your expense categories in Settings.</Label><Action onPress={() => onAdd('account')}>Add account</Action></Card>}
    <BudgetProgress plans={data.plans} spending={data.spending} />
    <Action onPress={onPlan}>Edit monthly plan</Action>
  </>;
  if (tab === 'Transactions') return <>
    <Heading>Money in & out</Heading>
    <View style={{ gap: 8 }}><Action onPress={() => onAdd('income')}>Add income</Action><Action onPress={() => onAdd('transfer')}>Transfer / repay card</Action></View>
    {data.transactions.length ? data.transactions.map(item => <Card key={item.id}>
      <Label style={{ fontWeight: '600', fontSize: 17 }}>{item.kind === 'expense' ? item.category : item.kind === 'income' ? item.source : 'Transfer'}</Label>
      <Label muted>{item.date} · {item.account}{item.destination ? ` → ${item.destination}` : ''}{item.card ? ` · ${item.card}` : ''}</Label>
      {!!item.note && <Label>{item.note}</Label>}
      <Label style={{ fontWeight: '600', fontSize: 17, color: item.kind === 'income' ? theme.income : item.kind === 'expense' ? theme.expense : theme.text }}>{item.kind === 'income' ? '+' : item.kind === 'expense' ? '−' : '↔'} {pkr(item.amount)}</Label>
      <View style={{ flexDirection: 'row', gap: 8 }}><Action onPress={() => onEdit(item.id)}>Edit</Action><Action onPress={() => remove(item.id)}>Delete</Action></View>
    </Card>) : <EmptyState title="No transactions" detail="No saved transactions for this month. Use + for an expense." />}
  </>;
  if (tab === 'Budgets') return <><Heading>Give every rupee a plan</Heading><Action onPress={onPlan}>Edit monthly plan</Action><Label muted>Plan for the selected month, or copy allocations from a past month in the editor.</Label><BudgetProgress plans={data.plans} spending={data.spending} /></>;
  if (tab === 'Accounts') return <>
    <Heading>Your money, in one place</Heading><Action onPress={() => onAdd('account')}>Add account</Action><Action onPress={() => onAdd('card')}>Add debit card</Action>
    {data.accounts.length ? data.accounts.map(account => <Card key={account.id}>
      <Label style={{ fontSize: 17, fontWeight: '600' }}>{account.name}</Label>
      <Label muted>{account.kind === 'credit' ? (account.balance < 0 ? 'Amount owed' : 'Credit in your favor') : account.balance < 0 ? 'Negative balance' : 'Available balance'}</Label>
      <Label style={{ fontSize: 23, lineHeight: 29, fontWeight: '600' }}>{pkr(account.kind === 'credit' ? Math.abs(account.balance) : account.balance)}</Label>
      <Label muted>{account.kind === 'credit' ? 'Credit card' : account.kind === 'bank' ? 'Bank account' : 'Cash'} · Current balance across all dates</Label>
      {data.cards.filter(card => card.account_id === account.id).map(card => <Label muted key={card.id}>Debit card · {card.name}</Label>)}
    </Card>) : <EmptyState title="No accounts yet" detail="Add an account and its opening balance to get started." />}
  </>;
  return <><Heading>Make it yours</Heading>
    <InfoRow title="Currency" detail="PKR · Pakistani rupee" />
    <Heading>Expense categories</Heading><Action onPress={() => onAdd('category')}>Add category</Action>
    {data.categories.length ? data.categories.map(category => <View key={category.id}><InfoRow title={category.name} detail={category.parent_id ? `Under ${data.categories.find(p => p.id === category.parent_id)?.name}` : 'Top-level category'} /><Action onPress={() => onEditCategory(category)}>Edit {category.name}</Action></View>) : <Label muted>No categories yet. Add one before recording expenses.</Label>}
    <Heading>Income sources</Heading><Action onPress={() => onAdd('source')}>Add income source</Action>
    {data.sources.map(source => <InfoRow key={source.id} title={source.name} detail="Income source" />)}
    <BackupControls onChanged={onChanged} />
    <InfoRow title="Appearance" detail="Follows your phone's light or dark theme" />
  </>;
}
