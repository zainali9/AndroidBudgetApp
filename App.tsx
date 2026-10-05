import { useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { darkTheme, lightTheme, ThemeContext, useTheme } from './src/theme';
import { currentMonth } from './src/sampleData';
import { Icon, Label, MonthSelector, Tab } from './src/components/Common';
import { Action } from './src/components/FormControls';
import { BudgetScreens, ScreenData } from './src/screens/BudgetScreens';
import { DatabaseProvider, useRepository } from './src/data/DatabaseProvider';
import { Category, Entry, monthKey } from './src/data/storage';
import { EntryForm, FormKind } from './src/screens/EntryForm';
import { SetupForm, SetupTarget } from './src/screens/SetupForm';
import { BudgetForm, CategoryForm } from './src/screens/PlanningForms';

const tabs: Tab[] = ['Home', 'Transactions', 'Budgets', 'Accounts', 'Settings'];
export default function App() {
  const dark = useColorScheme() === 'dark';
  return <SafeAreaProvider><ThemeContext.Provider value={dark ? darkTheme : lightTheme}>
    <StatusBar style={dark ? 'light' : 'dark'} /><DatabaseProvider><BudgetApp /></DatabaseProvider>
  </ThemeContext.Provider></SafeAreaProvider>;
}
function BudgetApp() {
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('Home');
  const [month, setMonth] = useState(currentMonth);
  const [form, setForm] = useState<FormKind | null>(null);
  const [setupEditing, setSetupEditing] = useState<SetupTarget | null>(null);
  const [planning, setPlanning] = useState(false);
  const [categoryEditing, setCategoryEditing] = useState<Category | null>(null);
  const [editing, setEditing] = useState<{ id: number; entry: Entry } | null>(null);
  const openForm = (kind: FormKind) => { setEditing(null); setForm(kind); };
  const [revision, setRevision] = useState(0);
  const repo = useRepository();
  // Saving changes revision, which refreshes the shared data supplied to all screens.
  const data = useMemo(() => {
    try {
      const key = monthKey(month);
      const palette = ['#3B9D83', '#E8AD51', '#8584D8', '#CF708B', '#4A9CBD'];
      const categories = repo.categories();
      const spending = repo.spending(key);
      const snapshot: ScreenData = {
        accounts: repo.accounts(), categories, cards: repo.debitCards(), sources: repo.incomeSources(),
        transactions: repo.transactions(key),
        plans: repo.budgetTotals(key).map(plan => ({ id: plan.categoryId, name: categories.find(c => c.id === plan.categoryId)!.name, planned: plan.amount, spent: spending.find(c => c.categoryId === plan.categoryId)?.spent ?? 0, color: palette[(plan.categoryId - 1) % palette.length] })),
        spending: spending.map(item => ({ id: item.categoryId, name: item.name, spent: item.spent, planned: 0, color: palette[(item.categoryId - 1) % palette.length] })),
      };
      return snapshot;
    } catch { return null; }
  }, [repo, month, revision]);
  const changeMonth = (value: number) => setMonth(Math.max(1900 * 12, Math.min(9999 * 12 + 11, value)));
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tab !== 'Home') { setTab('Home'); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [tab]);
  return <SafeAreaView style={[s.root, { backgroundColor: theme.background }]}>
    <View style={s.header}><Label style={{ fontSize: 23, lineHeight: 30, fontWeight: '700' }}>My Budget</Label><Label muted>{tab}</Label></View>
    <View style={s.body}>
      <ScrollView key={tab} keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
        <View style={[s.notice, { backgroundColor: theme.tint }]}><Label style={{ fontSize: 11, fontWeight: '600', letterSpacing: 0.5 }}>ON THIS DEVICE · PKR</Label></View>
        {['Home', 'Transactions', 'Budgets'].includes(tab) && <MonthSelector month={month} onChange={changeMonth} />}
        {data ? <BudgetScreens onEditSetup={setSetupEditing} onPlan={() => setPlanning(true)} onEditCategory={setCategoryEditing} tab={tab} data={data} onAdd={openForm} onChanged={() => setRevision(value => value + 1)} onEdit={id => { const entry = repo.entry(id); setEditing({ id, entry }); setForm(entry.kind); }} /> : <><Label>Could not load your records. Your data has not been reset.</Label><Action onPress={() => setRevision(value => value + 1)}>Try again</Action></>}
      </ScrollView>
      {data && (tab === 'Home' || tab === 'Transactions') && <Pressable accessibilityRole="button" accessibilityLabel="Add expense" onPress={() => openForm('expense')} style={({ pressed }) => [s.fab, { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 }]}>
        <Icon name="add" color={theme.background} />
      </Pressable>}
    </View>
    <View accessibilityRole="tablist" style={[s.tabs, { backgroundColor: theme.surface, borderTopColor: theme.line }]}>
      {tabs.map(item => <Pressable key={item} accessibilityRole="tab" accessibilityLabel={`${item} tab`} accessibilityState={{ selected: tab === item }} onPress={() => setTab(item)} style={({ pressed }) => [s.tab, { opacity: pressed ? 0.7 : 1 }]}>
        <View style={[s.tabIcon, { backgroundColor: tab === item ? theme.tint : 'transparent' }]}><Icon name={item} color={tab === item ? theme.primary : theme.muted} /></View>
        <Text style={[s.tabLabel, { color: tab === item ? theme.primary : theme.muted }]}>{item}</Text>
      </Pressable>)}
    </View>
    {setupEditing && <SetupForm target={setupEditing} onClose={() => setSetupEditing(null)} onSaved={() => { setSetupEditing(null); setRevision(value => value + 1); }} />}
    {planning && <BudgetForm month={monthKey(month)} onClose={() => setPlanning(false)} onSaved={() => { setPlanning(false); setRevision(value => value + 1); }} />}
    {categoryEditing && <CategoryForm category={categoryEditing} onClose={() => setCategoryEditing(null)} onSaved={() => { setCategoryEditing(null); setRevision(value => value + 1); }} />}
    {form && <EntryForm key={`${form}-${editing?.id ?? 'new'}`} kind={form} initial={editing?.entry} entryId={editing?.id} onClose={() => setForm(null)} onSaved={date => {
      setForm(null);
      if (date) {
        const [year, number] = date.split('-').map(Number);
        setMonth(year * 12 + number - 1);
        setTab('Transactions');
      }
      setRevision(value => value + 1);
    }} />}
  </SafeAreaView>;
}
const s = StyleSheet.create({
  root: { flex: 1 }, header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  body: { flex: 1 }, content: { padding: 20, paddingTop: 8, paddingBottom: 90, gap: 18 },
  notice: { padding: 10, borderRadius: 10 },
  fab: { position: 'absolute', right: 18, bottom: 16, width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', elevation: 3 },
  tabs: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 6, paddingBottom: 8 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', gap: 4, minHeight: 56, paddingHorizontal: 1 },
  tabIcon: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 18 },
  tabLabel: { fontSize: 11, lineHeight: 15, textAlign: 'center' },
});
