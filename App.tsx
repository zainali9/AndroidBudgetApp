import { useEffect, useState } from 'react';
import { BackHandler, Modal, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { darkTheme, lightTheme, ThemeContext, useTheme } from './src/theme';
import { budgetsForMonth, currentMonth } from './src/sampleData';
import { Heading, Icon, InfoRow, Label, MonthSelector, Tab } from './src/components/Common';
import { BudgetScreens } from './src/screens/BudgetScreens';

import { DatabaseProvider } from './src/data/DatabaseProvider';

const tabs: Tab[] = ['Home', 'Transactions', 'Budgets', 'Accounts', 'Settings'];

export default function App() {
  const dark = useColorScheme() === 'dark';
  return <SafeAreaProvider><ThemeContext.Provider value={dark ? darkTheme : lightTheme}>
    <StatusBar style={dark ? 'light' : 'dark'} /><DatabaseProvider><BudgetApp /></DatabaseProvider>
  </ThemeContext.Provider></SafeAreaProvider>;
}

function BudgetApp() {
  const theme = useTheme();
  // Shared state lives above the screens so changing tabs keeps the selected month.
  const [tab, setTab] = useState<Tab>('Home');
  const [previewMonth] = useState(currentMonth);
  const [month, setMonth] = useState(previewMonth);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const budgets = budgetsForMonth(month, previewMonth);

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
      <ScrollView key={tab} contentContainerStyle={s.content}>
        <View style={[s.notice, { backgroundColor: theme.tint }]}><Label style={{ fontSize: 11, fontWeight: '600', letterSpacing: 0.5 }}>DESIGN PREVIEW · Sample data only</Label></View>
        {['Home', 'Transactions', 'Budgets'].includes(tab) && <MonthSelector month={month} onChange={setMonth} />}
        <BudgetScreens tab={tab} budgets={budgets} hasSamples={month === previewMonth} />
      </ScrollView>
      {(tab === 'Home' || tab === 'Transactions') && <Pressable accessibilityRole="button" accessibilityLabel="Add expense" onPress={() => setExpenseOpen(true)} style={({ pressed }) => [s.fab, { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 }]}>
        <Icon name="add" color={theme.background} />
      </Pressable>}
    </View>
    <View accessibilityRole="tablist" style={[s.tabs, { backgroundColor: theme.surface, borderTopColor: theme.line }]}>
      {tabs.map(item => <Pressable key={item} accessibilityRole="tab" accessibilityLabel={`${item} tab`} accessibilityState={{ selected: tab === item }} onPress={() => setTab(item)} style={({ pressed }) => [s.tab, { opacity: pressed ? 0.7 : 1 }]}>
        <View style={[s.tabIcon, { backgroundColor: tab === item ? theme.tint : 'transparent' }]}><Icon name={item} color={tab === item ? theme.primary : theme.muted} /></View>
        <Text style={[s.tabLabel, { color: tab === item ? theme.primary : theme.muted }]}>{item}</Text>
      </Pressable>)}
    </View>
    <Modal visible={expenseOpen} transparent animationType="slide" onRequestClose={() => setExpenseOpen(false)}>
      <View style={s.overlay}>
        <Pressable accessibilityLabel="Dismiss expense preview" accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={() => setExpenseOpen(false)} />
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[s.sheet, { backgroundColor: theme.surface }]}>
          <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }}>
            <Heading>Add expense</Heading><Label muted>Expense entry is coming soon. This preview does not save anything.</Label>
            <InfoRow title="Amount" detail="PKR" /><InfoRow title="Category" detail="Category and optional subtype" /><InfoRow title="Paid with" detail="Account or card" /><InfoRow title="Date & note" detail="Purchase date and optional note" />
            <Pressable accessibilityRole="button" onPress={() => setExpenseOpen(false)} style={[s.button, { backgroundColor: theme.primary }]}><Text style={{ color: theme.background, fontWeight: '600', fontSize: 16 }}>Got it</Text></Pressable>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
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
  overlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  button: { minHeight: 48, padding: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});
