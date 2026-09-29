import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// A component is a function returning UI. TSX lets us write that UI inside TypeScript.
export default function App() {
  const dark = useColorScheme() === 'dark';
  const colors = dark
    ? { background: '#101B17', surface: '#1C2B24', text: '#ECF5EE', muted: '#A9BBAE', accent: '#91DCB8' }
    : { background: '#F5F7F1', surface: '#FFFFFF', text: '#173B2B', muted: '#586C60', accent: '#176B48' };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
        <StatusBar style={dark ? 'light' : 'dark'} />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>MY BUDGET</Text>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
            Your money.{ '\n' }Your own space.
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            A fresh start for your everyday budget, built for Android and iPhone.
          </Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.badge, { color: colors.accent }]}>STARTER CHECKPOINT</Text>
            <Text style={[styles.cardTitle, { color: colors.text }]}>The foundation is ready</Text>
            <Text style={[styles.body, { color: colors.muted }]}>
              This is the first React Native screen. Accounts, expenses, and budgets will arrive in the next milestones. No financial records are saved yet.
            </Text>
          </View>
          {[
            ['01', 'Designed for PKR', 'Track income, purchases, and monthly plans in rupees and paisa.'],
            ['02', 'Local by design', 'Your financial records will stay on your device, with manual backup and restore.'],
            ['03', 'Android first', 'We will build and test on Android, then verify the shared app on iOS.'],
          ].map(([number, title, detail]) => (
            <View key={number} style={styles.feature}>
              <Text style={[styles.number, { color: colors.accent }]}>{number}</Text>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: colors.text }]}>{title}</Text>
                <Text style={[styles.body, { color: colors.muted }]}>{detail}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 24, paddingTop: 36, gap: 22, maxWidth: 600, width: '100%', alignSelf: 'center' },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 3 },
  title: { fontSize: 36, lineHeight: 44, fontWeight: '700' },
  subtitle: { fontSize: 17, lineHeight: 26 },
  card: { padding: 22, borderRadius: 20, gap: 12, marginVertical: 8 },
  badge: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700' },
  cardTitle: { fontSize: 21, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 23 },
  feature: { flexDirection: 'row', gap: 16 },
  number: { fontSize: 14, fontWeight: '700', paddingTop: 4 },
  featureText: { flex: 1, gap: 4 },
  featureTitle: { fontSize: 17, fontWeight: '600' },
});
