import { useState } from 'react';
import { Keyboard, Platform, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { localDate } from '../data/storage';
import { Label } from './Common';
import { Action } from './FormControls';

// Construct in local time: parsing YYYY-MM-DD as UTC can shift the selected day.
export function DateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [year, month, day] = value.split('-').map(Number);
  return <View style={{ gap: 8 }}>
    <Label>Date</Label>
    <Action onPress={() => { Keyboard.dismiss(); setOpen(true); }}>Date · {value}</Action>
    {open && <>
      <DateTimePicker value={new Date(year, month - 1, day, 12)} mode="date" display={Platform.OS === 'android' ? 'calendar' : 'inline'}
        minimumDate={new Date(1900, 0, 1)} maximumDate={new Date(9999, 11, 31)}
        onValueChange={(_event, selected) => { if (Platform.OS === 'android') setOpen(false); onChange(localDate(selected)); }}
        onDismiss={() => setOpen(false)} />
      {Platform.OS === 'ios' && <Action onPress={() => setOpen(false)}>Done</Action>}
    </>}
  </View>;
}
