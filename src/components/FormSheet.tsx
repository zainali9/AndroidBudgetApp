import { PropsWithChildren } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { Heading } from './Common';
import { Action } from './FormControls';

export function FormSheet({ title, dirty, onClose, children }: PropsWithChildren<{ title: string; dirty: boolean; onClose: () => void }>) {
  const theme = useTheme();
  const cancel = () => dirty ? Alert.alert('Discard changes?', 'Your unsaved changes will be lost.', [
    { text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: onClose },
  ]) : onClose();
  return <Modal animationType="slide" onRequestClose={cancel}>
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 18 }}>
          <Heading>{title}</Heading>{children}<Action onPress={cancel}>Cancel</Action>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}
