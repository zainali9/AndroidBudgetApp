import { PropsWithChildren } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useTheme } from '../theme';
import { Label } from './Common';

export function Action({ children, onPress, disabled = false }: PropsWithChildren<{ onPress: () => void; disabled?: boolean }>) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 48, borderRadius: 12, padding: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.tint, opacity: disabled || pressed ? 0.55 : 1 })}>
    <Label style={{ fontWeight: '600' }}>{children}</Label>
  </Pressable>;
}
export function Field({ label, value, onChange, numeric = false, multiline = false, maxLength = 100 }: {
  label: string; value: string; onChange: (text: string) => void; numeric?: boolean; multiline?: boolean; maxLength?: number;
}) {
  const theme = useTheme();
  return <View style={{ gap: 6 }}><Label style={{ fontWeight: '600' }}>{label}</Label>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} keyboardType={numeric ? 'decimal-pad' : 'default'}
      multiline={multiline} maxLength={maxLength} autoCorrect={false}
      style={{ minHeight: 48, borderWidth: 1, borderColor: theme.line, borderRadius: 10, padding: 12, fontSize: 16, color: theme.text, backgroundColor: theme.surface }} />
  </View>;
}
export function Choice({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  const theme = useTheme();
  return <View style={{ gap: 6 }}><Label style={{ fontWeight: '600' }}>{label}</Label>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{options.map(option => <Pressable key={option.value}
      accessibilityRole="radio" accessibilityState={{ checked: value === option.value }} accessibilityLabel={`${label}: ${option.label}`}
      onPress={() => onChange(option.value)} style={{ maxWidth: '100%', minHeight: 48, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: value === option.value ? theme.primary : theme.line, backgroundColor: value === option.value ? theme.tint : theme.surface }}>
      <Label>{value === option.value ? '✓ ' : ''}{option.label}</Label>
    </Pressable>)}</View>
  </View>;
}
