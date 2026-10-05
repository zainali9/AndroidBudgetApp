import { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, TextStyle, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme';
import { monthLabel } from '../sampleData';

export const icons = {
  Home: 'M3 10L12 3L21 10V21H15V14H9V21H3Z',
  Transactions: 'M4 5H17L14 2L15.4 .6L21 6L15.4 11.4L14 10L17 7H4ZM20 17H7L10 14L8.6 12.6L3 18L8.6 23.4L10 22L7 19H20Z',
  Budgets: 'M4 3H20V21H4ZM6 5V19H18V5ZM8 8H16V10H8ZM8 12H13V14H8ZM8 16H15V18H8Z',
  Accounts: 'M3 5H21V19H3ZM5 7V9H19V7ZM5 12V17H19V12ZM7 14H12V16H7Z',
  Settings: 'M4 5H20V7H4ZM4 11H20V13H4ZM4 17H20V19H4ZM8 3H10V9H8ZM14 9H16V15H14ZM7 15H9V21H7Z',
  previous: 'M15.4 5.4L14 4L6 12L14 20L15.4 18.6L8.8 12Z',
  next: 'M8.6 5.4L10 4L18 12L10 20L8.6 18.6L15.2 12Z',
  edit: 'M3 17.25V21H6.75L17.81 9.94L14.06 6.19ZM20.71 7.04A1 1 0 0 0 20.71 5.63L18.37 3.29A1 1 0 0 0 16.96 3.29L15.13 5.12L18.88 8.87Z',
  add: 'M11 5H13V11H19V13H13V19H11V13H5V11H11Z',
};
export type Tab = 'Home' | 'Transactions' | 'Budgets' | 'Accounts' | 'Settings';
export function Icon({ name, color }: { name: keyof typeof icons; color: string }) {
  return <Svg width={23} height={23} viewBox="0 0 24 24" accessible={false}><Path d={icons[name]} fill={color} /></Svg>;
}
export function Label({ children, muted = false, style }: PropsWithChildren<{ muted?: boolean; style?: TextStyle }>) {
  const theme = useTheme();
  return <Text style={[{ color: muted ? theme.muted : theme.text, fontSize: 14, lineHeight: 21 }, style]}>{children}</Text>;
}
export function Heading({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>{children}</Text>;
}
export function Card({ children, tinted = false }: PropsWithChildren<{ tinted?: boolean }>) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: tinted ? theme.tint : theme.surface }]}>{children}</View>;
}
export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <Card><Label style={{ fontSize: 17, fontWeight: '600' }}>{title}</Label><Label muted>{detail}</Label></Card>;
}
export function InfoRow({ title, detail }: { title: string; detail: string }) {
  const theme = useTheme();
  return <View style={{ gap: 4, paddingVertical: 12, borderBottomWidth: 1, borderColor: theme.line }}>
    <Label style={{ fontWeight: '600' }}>{title}</Label><Label muted>{detail}</Label>
  </View>;
}
export function MonthSelector({ month, onChange }: { month: number; onChange: (month: number) => void }) {
  const theme = useTheme();
  return <View style={styles.month}>
    <Pressable accessibilityRole="button" accessibilityLabel="Previous month" style={styles.iconButton} onPress={() => onChange(month - 1)}><Icon name="previous" color={theme.text} /></Pressable>
    <Label style={{ fontSize: 17, fontWeight: '600', textAlign: 'center', flex: 1 }}>{monthLabel(month)}</Label>
    <Pressable accessibilityRole="button" accessibilityLabel="Next month" style={styles.iconButton} onPress={() => onChange(month + 1)}><Icon name="next" color={theme.text} /></Pressable>
  </View>;
}
export const styles = StyleSheet.create({
  heading: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  card: { padding: 18, borderRadius: 18, gap: 7 },
  month: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});

export function EditableRow({ title, detail, onEdit }: { title: string; detail: string; onEdit: () => void }) {
  const theme = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, borderBottomWidth: 1, borderColor: theme.line }}>
    <View style={{ flex: 1, paddingVertical: 4 }}><Label style={{ fontWeight: '600' }}>{title}</Label><Label muted>{detail}</Label></View>
    <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${title}`} onPress={onEdit} style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}><Icon name="edit" color={theme.primary} /></Pressable>
  </View>;
}
