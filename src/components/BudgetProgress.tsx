import { View } from 'react-native';
import { Budget, pkr } from '../sampleData';
import { addMoney } from '../data/storage';
import { useTheme } from '../theme';
import { Card, EmptyState, Label } from './Common';

export function BudgetProgress({ plans, spending }: { plans: Budget[]; spending: Budget[] }) {
  const theme = useTheme();
  const planned = plans.reduce((sum, row) => addMoney(sum, row.planned), 0);
  const spent = plans.reduce((sum, row) => addMoney(sum, row.spent), 0);
  const unbudgeted = spending.filter(row => !plans.some(plan => plan.id === row.id));
  const unbudgetedTotal = unbudgeted.reduce((sum, row) => addMoney(sum, row.spent), 0);
  return <View style={{ gap: 10 }}>
    {plans.length ? <>
      <Card tinted><Label>Monthly plan · {pkr(planned)}</Label><Label>Spent in planned categories · {pkr(spent)}</Label>
        <Label style={{ color: spent > planned ? theme.expense : theme.text }}>{spent > planned ? 'Over plan' : 'Remaining in plan'} · {pkr(Math.abs(planned - spent))}</Label>
        {!!unbudgetedTotal && <Label>Additional unbudgeted spending · {pkr(unbudgetedTotal)}</Label>}
      </Card>
      <Label style={{ fontSize: 18, fontWeight: '600' }}>Budgets · largest first</Label>
      {[...plans].sort((a, b) => b.planned - a.planned || a.name.localeCompare(b.name)).map(row => {
        const ratio = row.planned ? Math.min(1, row.spent / row.planned) : row.spent ? 1 : 0;
        const over = row.spent > row.planned;
        return <View key={row.id} style={{ padding: 12, gap: 5, borderRadius: 12, backgroundColor: theme.surface }}>
          <Label style={{ fontWeight: '600' }}>{row.name}</Label>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <Label style={{ flex: 1 }}>{pkr(row.spent)} / {pkr(row.planned)}</Label>
            <Label style={{ flex: 1, textAlign: 'right', color: over ? theme.expense : theme.muted }}>{over ? 'Over budget' : 'Remaining'} · {pkr(Math.abs(row.planned - row.spent))}</Label>
          </View>
          <View accessible accessibilityRole="progressbar" accessibilityLabel={`${row.name}: spent ${pkr(row.spent)} of ${pkr(row.planned)}`} accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }} style={{ height: 7, borderRadius: 4, backgroundColor: theme.tint, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${ratio * 100}%`, backgroundColor: over ? theme.expense : theme.primary }} />
          </View>
        </View>;
      })}
    </> : <EmptyState title="No budget set for this month" detail="Edit the monthly plan to assign limits. Expenses are still tracked without a plan." />}
    {!!unbudgeted.length && <><Label style={{ fontSize: 18, fontWeight: '600' }}>Spending without a budget</Label>
      {[...unbudgeted].sort((a, b) => b.spent - a.spent).map(row => <View key={row.id} style={{ backgroundColor: theme.surface, padding: 12, gap: 4, borderRadius: 12 }}><Label>{row.name}</Label><Label>{pkr(row.spent)} · No budget set</Label></View>)}
    </>}
  </View>;
}
