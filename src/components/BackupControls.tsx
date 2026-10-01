import { useRef, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { useRepository } from '../data/DatabaseProvider';
import { BACKUP_LIMIT, parseBackup } from '../data/storage';
import { Action } from './FormControls';
import { Heading, Label } from './Common';

export function BackupControls({ onChanged }: { onChanged: () => void }) {
  const repo = useRepository();
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const recovery = new File(Paths.document, 'budget-before-restore.json');
  const confirm = (accounts: number, entries: number) => new Promise<boolean>(resolve => {
    Alert.alert('Replace all current records?', `This backup contains ${accounts} accounts and ${entries} transactions. All current accounts, categories, entries and plans will be replaced. A recovery copy will be kept on this device.`, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Replace records', style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: false });
  });
  const run = async (work: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setStatus('');
    try { await work(); }
    catch { setStatus('Could not complete this operation. Check the file and destination, then try again. A failed restore leaves your current records unchanged.'); }
    finally { locked.current = false; setBusy(false); }
  };
  const exportText = async (text: string, prefix: string) => {
    const name = `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    if (Platform.OS === 'android') {
      const permission = await LegacyFileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permission.granted) { setStatus('Backup cancelled. No backup file was saved.'); return; }
      const uri = await LegacyFileSystem.StorageAccessFramework.createFileAsync(permission.directoryUri, name, 'application/json');
      await LegacyFileSystem.writeAsStringAsync(uri, text);
      setStatus('Backup saved in the folder you selected.');
    } else {
      const file = new File(Paths.cache, name);
      try {
        file.write(text);
        if (!await Sharing.isAvailableAsync()) throw new Error('Sharing unavailable');
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
        setStatus('Share sheet closed. Confirm the file was saved to your chosen destination.');
      } finally { try { if (file.exists) file.delete(); } catch { /* Cache cleanup must not misreport a completed restore/export. */ } }
    }
  };
  const restore = async () => {
    const selected = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', 'application/octet-stream'], copyToCacheDirectory: true, multiple: false });
    if (selected.canceled) return;
    const file = new File(selected.assets[0].uri);
    try {
      if (file.size > BACKUP_LIMIT) throw new Error('Backup too large');
      const text = await file.text();
      const backup = parseBackup(text);
      if (!await confirm(backup.tables.accounts.length, backup.tables.transactions.length)) return;
      const before = repo.exportBackup(); parseBackup(before); recovery.write(before);
      repo.restoreBackup(text);
      onChanged();
      setStatus('Backup restored. The previous records are available using Export recovery copy.');
    } finally { try { if (file.exists) file.delete(); } catch { /* Cache cleanup must not misreport a completed restore/export. */ } }
  };
  return <View style={{ gap: 12 }}>
    <Heading>Backup & restore</Heading>
    <Label muted>Backups include all your records in a readable JSON file. Keep them somewhere private and copy them off the phone. They are not encrypted.</Label>
    <Action disabled={busy} onPress={() => void run(async () => { const text = repo.exportBackup(); parseBackup(text); await exportText(text, 'my-budget'); })}>Export backup</Action>
    <Action disabled={busy} onPress={() => void run(restore)}>Restore backup</Action>
    {recovery.exists && <Action disabled={busy} onPress={() => void run(async () => exportText(await recovery.text(), 'my-budget-recovery'))}>Export recovery copy</Action>}
    {!!status && <View accessibilityLiveRegion="polite"><Label>{status}</Label></View>}
  </View>;
}
