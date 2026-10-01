import { View } from 'react-native';
import { Budget, pkr, spendingTotal } from '../sampleData';
import { Account, Category, DebitCard, IncomeSource, SavedTransaction } from '../data/storage';
import { useTheme } from '../theme';
import { Card, EmptyState, Heading, InfoRow, Label, Tab } from '../components/Common';
import { Action } from '../components/FormControls';
import { BudgetProgress } from '../components/BudgetProgress';
import { BackupControls } from '../components/BackupControls';
import { TransactionsScreen } from './TransactionsScreen';
import { ExpensePieChart } from '../components/ExpensePieChart';
import { SetupTarget } from './SetupForm';
import { FormKind } from './EntryForm';

export type ScreenData = {
  accounts: (Account & { balance: number })[]; categories: Category[]; cards: DebitCard[];
  sources: IncomeSource[]; transactions: SavedTransaction[]; spending: Budget[]; plans: Budget[];
};
export function BudgetScreens({ tab, data, onAdd, onEdit, onChanged, onPlan, onEditCategory, onEditSetup }: { onEditSetup: (target: SetupTarget) => void; onPlan: () => void; onEditCategory: (category: Category) => void; tab: Tab; data: ScreenData; onAdd: (kind: FormKind) => void; onEdit: (id: number) => void; onChanged: () => void }) {
  const theme = useTheme();
  if (tab === 'Home') return <>
    <Heading>Your month at a glance</Heading>
    <ExpensePieChart budgets={data.spending} />
    <Card tinted><Label>Total expenses</Label><Label style={{ fontSize: 28, lineHeight: 36, fontWeight: '700' }}>{pkr(spendingTotal(data.spending))}</Label></Card>
    {!data.accounts.length && <Card><Heading>Start with your accounts</Heading><Label muted>Add cash, a bank account or a credit card, then create your expense categories in Settings.</Label><Action onPress={() => onAdd('account')}>Add account</Action></Card>}
    <BudgetProgress plans={data.plans} spending={data.spending} />
    <Action onPress={onPlan}>Edit monthly plan</Action>
  </>;
  if (tab === 'Transactions') return <TransactionsScreen rows={data.transactions} accounts={data.accounts} categories={data.categories} onAdd={onAdd} onEdit={onEdit} onChanged={onChanged} />;
  if (tab === 'Budgets') return <><Heading>Give every rupee a plan</Heading><Action onPress={onPlan}>Edit monthly plan</Action><Label muted>Plan for the selected month, or copy allocations from a past month in the editor.</Label><BudgetProgress plans={data.plans} spending={data.spending} /></>;
  if (tab === 'Accounts') return <>
    <Heading>Your money, in one place</Heading><Action onPress={() => onAdd('account')}>Add account</Action><Action onPress={() => onAdd('card')}>Add debit card</Action>
    {data.accounts.length ? data.accounts.map(account => <Card key={account.id}>
      <Label style={{ fontSize: 17, fontWeight: '600' }}>{account.name}</Label>
      <Label muted>{account.kind === 'credit' ? (account.balance < 0 ? 'Amount owed' : 'Credit in your favor') : account.balance < 0 ? 'Negative balance' : 'Available balance'}</Label>
      <Label style={{ fontSize: 23, lineHeight: 29, fontWeight: '600' }}>{pkr(account.kind === 'credit' ? Math.abs(account.balance) : account.balance)}</Label>
      <Label muted>{account.kind === 'credit' ? 'Credit card' : account.kind === 'bank' ? 'Bank account' : 'Cash'} · Current balance across all dates</Label>
      <Action onPress={() => onEditSetup({ kind: 'account', record: account })}>Edit account</Action>
      {data.cards.filter(card => card.account_id === account.id).map(card => <View key={card.id} style={{ gap: 5 }}><Label muted>Debit card · {card.name}</Label><Action onPress={() => onEditSetup({ kind: 'card', record: card })}>Edit {card.name}</Action></View>)}
    </Card>) : <EmptyState title="No accounts yet" detail="Add an account and its opening balance to get started." />}
  </>;
  return <><Heading>Make it yours</Heading>
    <InfoRow title="Currency" detail="PKR · Pakistani rupee" />
    <Heading>Expense categories</Heading><Action onPress={() => onAdd('category')}>Add category</Action>
    {data.categories.length ? data.categories.map(category => <View key={category.id}><InfoRow title={category.name} detail={category.parent_id ? `Under ${data.categories.find(p => p.id === category.parent_id)?.name}` : 'Top-level category'} /><Action onPress={() => onEditCategory(category)}>Edit {category.name}</Action></View>) : <Label muted>No categories yet. Add one before recording expenses.</Label>}
    <Heading>Income sources</Heading><Action onPress={() => onAdd('source')}>Add income source</Action>
    {data.sources.map(source => <View key={source.id}><InfoRow title={source.name} detail="Income source" /><Action onPress={() => onEditSetup({ kind: 'source', record: source })}>Edit {source.name}</Action></View>)}
    <BackupControls onChanged={onChanged} />
    <InfoRow title="Appearance" detail="Follows your phone's light or dark theme" />
  </>;
}
