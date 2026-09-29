import { View } from 'react-native';
import { Budget, pkr, sampleTransactions, spendingTotal } from '../sampleData';
import { useTheme } from '../theme';
import { Card, EmptyState, Heading, InfoRow, Label, Tab } from '../components/Common';
import { ExpensePieChart } from '../components/ExpensePieChart';

function BudgetCard({ budget, detailed = false }: { budget: Budget; detailed?: boolean }) {
  const theme = useTheme();
  const ratio = budget.planned > 0 ? budget.spent / budget.planned : 0;
  const remaining = budget.planned - budget.spent;
  return <View style={{ backgroundColor: theme.surface, padding: 13, borderRadius: 14, gap: 6 }}>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Label style={{ fontWeight: '600', flex: 1 }}>{budget.name}</Label>
      <Label muted style={{ fontSize: 12 }}>{Math.round(ratio * 100)}% spent</Label>
    </View>
    <Label muted style={{ fontSize: 12 }}>{pkr(budget.spent)} of {pkr(budget.planned)}</Label>
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`${budget.name} budget used`} accessibilityValue={{ min: 0, max: 100, now: Math.min(100, Math.round(ratio * 100)), text: `${Math.round(ratio * 100)} percent spent` }} style={{ height: 6, borderRadius: 3, backgroundColor: theme.line, overflow: 'hidden' }}>
      <View style={{ height: '100%', width: `${Math.min(100, Math.max(0, ratio * 100))}%`, backgroundColor: remaining < 0 ? theme.expense : theme.primary }} />
    </View>
    {detailed && <Label muted>{pkr(Math.abs(remaining))} {remaining < 0 ? 'over budget' : 'remaining'}</Label>}
  </View>;
}
export function BudgetScreens({ tab, budgets, hasSamples }: { tab: Tab; budgets: Budget[]; hasSamples: boolean }) {
  const theme = useTheme();
  if (tab === 'Home') return <>
    <Heading>Your month at a glance</Heading>
    <ExpensePieChart budgets={budgets} />
    <Card tinted><Label>Total expenses</Label><Label style={{ fontSize: 28, lineHeight: 36, fontWeight: '700' }}>{pkr(spendingTotal(budgets))}</Label></Card>
    <Label style={{ fontSize: 20, fontWeight: '600' }}>Budget overview</Label>
    {budgets.length ? <View style={{ gap: 8 }}>{[...budgets].sort((a, b) => b.planned - a.planned).map(b => <BudgetCard key={b.name} budget={b} />)}</View>
      : <EmptyState title="A fresh month" detail="No sample expenses or budgets for this month. Return to the current month to explore the preview." />}
  </>;
  if (tab === 'Transactions') return <>
    <Heading>Money in & out</Heading><Label muted>Your income and purchases in one place.</Label>
    {hasSamples ? sampleTransactions.map(item => <Card key={item.name}>
      <Label style={{ fontWeight: '600', fontSize: 17 }}>{item.name}</Label><Label muted>{item.detail}</Label>
      <Label style={{ fontWeight: '600', fontSize: 17, color: item.kind === 'income' ? theme.income : theme.expense }}>{item.kind === 'income' ? '+' : '−'} {pkr(item.amount)}</Label>
    </Card>) : <EmptyState title="No transactions" detail="No sample transactions for the selected month." />}
  </>;
  if (tab === 'Budgets') return <>
    <Heading>Give every rupee a plan</Heading><Label muted>Subcategory spending will count toward its parent category.</Label>
    {budgets.length ? <><Label>Planned · {pkr(budgets.reduce((sum, b) => sum + b.planned, 0))}</Label>{[...budgets].sort((a, b) => b.planned - a.planned).map(b => <BudgetCard key={b.name} budget={b} detailed />)}</>
      : <EmptyState title="No budget plan" detail="Planning and copying a previous month will arrive in a later milestone." />}
    <Label muted>Coming soon: create a plan or copy a past month.</Label>
  </>;
  if (tab === 'Accounts') return <>
    <Heading>Your money, in one place</Heading>
    {[
      { name: 'Bank account', label: 'Available balance', amount: 12500000, note: 'Debit card linked to this account' },
      { name: 'Cash', label: 'Available balance', amount: 800000, note: 'Money in your wallet' },
      { name: 'Credit card', label: 'Amount owed', amount: 450000, note: 'Purchases increase debt; repayments reduce it' },
    ].map(account => <Card key={account.name}><Label style={{ fontSize: 17, fontWeight: '600' }}>{account.name}</Label><Label muted>{account.label}</Label><Label style={{ fontSize: 23, lineHeight: 29, fontWeight: '600' }}>{pkr(account.amount)}</Label><Label muted>{account.note}</Label></Card>)}
    <Label muted>Coming soon: add your accounts and opening balances.</Label>
  </>;
  return <><Heading>Make it yours</Heading><View>
    <InfoRow title="Currency" detail="PKR · Pakistani rupee" />
    <InfoRow title="Appearance" detail="Follows your phone's light or dark theme" />
    <InfoRow title="Expense categories" detail="Coming soon: categories and optional subcategories" />
    <InfoRow title="Income sources" detail="Coming soon: salary, freelance work, and more" />
    <InfoRow title="Backup & restore" detail="Coming soon: export and restore your records" />
    <InfoRow title="About this version" detail="Design preview. No financial records are saved yet." />
  </View></>;
}
