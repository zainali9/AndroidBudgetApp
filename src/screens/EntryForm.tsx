import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRepository } from '../data/DatabaseProvider';
import { AccountKind, localDate, parsePkr } from '../data/storage';
import { Heading, Label } from '../components/Common';
import { Action, Choice, Field } from '../components/FormControls';
import { useTheme } from '../theme';

export type FormKind = 'account' | 'card' | 'category' | 'source' | 'expense' | 'income' | 'transfer';
const titles: Record<FormKind, string> = { account: 'Add account', card: 'Add debit card', category: 'Add category', source: 'Add income source', expense: 'Add expense', income: 'Add income', transfer: 'Transfer / repay card' };
export function EntryForm({ kind, onClose, onSaved }: { kind: FormKind; onClose: () => void; onSaved: (date?: string) => void }) {
  const repo = useRepository();
  const theme = useTheme();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [accountKind, setAccountKind] = useState<AccountKind>('bank');
  const [negative, setNegative] = useState('positive');
  const [account, setAccount] = useState('');
  const [destination, setDestination] = useState('');
  const [category, setCategory] = useState('');
  const [parent, setParent] = useState('');
  const [source, setSource] = useState('');
  const [card, setCard] = useState('');
  const [date, setDate] = useState(localDate);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const saving = useRef(false);
  const [saved, setSaved] = useState(false);
  const accounts = repo.accounts();
  const categories = repo.categories();
  const sources = repo.incomeSources();
  const cards = repo.debitCards().filter(item => String(item.account_id) === account);
  const transaction = ['expense', 'income', 'transfer'].includes(kind);
  const options = (items: { id: number; name: string }[]) => items.map(item => ({ value: String(item.id), label: item.name }));
  const chooseId = (value: string, label: string) => { if (!value) throw new Error(`Choose ${label}`); return Number(value); };
  const dirty = Boolean(accountKind !== 'bank' || negative !== 'positive' || name || amount || account || destination || category || parent || source || card || note || date !== localDate());
  const close = () => {
    if (!dirty) { onClose(); return; }
    Alert.alert('Discard this entry?', 'Your unsaved changes will be lost.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: onClose }]);
  };
  const save = () => {
    if (saving.current) return;
    saving.current = true;
    setError('');
    try {
      if (kind === 'account') repo.createAccount(name, accountKind, (negative === 'negative' ? -1 : 1) * parsePkr(amount || '0'));
      else if (kind === 'card') repo.createDebitCard(name, chooseId(account, 'a bank account'));
      else if (kind === 'category') repo.createCategory(name, parent ? Number(parent) : null);
      else if (kind === 'source') repo.createIncomeSource(name);
      else {
        const common = { amount: parsePkr(amount), date, note, accountId: chooseId(account, 'an account') };
        if (kind === 'expense') repo.record({ ...common, kind, categoryId: chooseId(category, 'a category'), cardId: card ? Number(card) : undefined });
        else if (kind === 'income') repo.record({ ...common, kind, sourceId: chooseId(source, 'an income source') });
        else {
          const destinationId = chooseId(destination, 'a destination account');
          if (destinationId === common.accountId) throw new Error('Choose different source and destination accounts');
          repo.record({ ...common, kind, destinationId });
        }
      }
      setSaved(true);
      onSaved(transaction ? date : undefined);
    } catch (problem) {
      const message = problem instanceof Error ? problem.message : '';
      setError(/SQL|constraint|FOREIGN|database/i.test(message) ? 'Could not save this entry. Check your selections and try again.' : message || 'Could not save. Please try again.');
      saving.current = false;
    }
  };
  return <Modal visible animationType="slide" onRequestClose={close}>
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 40 }}>
          <Heading>{titles[kind]}</Heading>
          {!transaction && <Field label="Name" value={name} onChange={setName} />}
          {kind === 'account' && <>
            <Choice label="Account type" value={accountKind} options={[{ value: 'bank', label: 'Bank' }, { value: 'cash', label: 'Cash' }, { value: 'credit', label: 'Credit card' }]} onChange={value => { setAccountKind(value as AccountKind); setNegative(value === 'credit' ? 'negative' : 'positive'); }} />
            <Field label="Opening amount (PKR)" value={amount} onChange={setAmount} numeric maxLength={20} />
            <Choice label="Opening balance meaning" value={negative} options={[{ value: 'positive', label: accountKind === 'credit' ? 'Credit in your favor' : 'Available money' }, { value: 'negative', label: accountKind === 'credit' ? 'Amount owed' : 'Overdraft / negative balance' }]} onChange={setNegative} />
            <Label muted>Use your balance before the transactions you plan to enter. Opening balances do not count as income or expenses.</Label>
          </>}
          {(transaction || kind === 'card') && <>
            <Choice label={kind === 'transfer' ? 'From account' : kind === 'income' ? 'Received into' : kind === 'card' ? 'Linked bank account' : 'Paid from'} value={account} options={options(kind === 'card' ? accounts.filter(a => a.kind === 'bank') : accounts)} onChange={value => { setAccount(value); setCard(''); if (destination === value) setDestination(''); }} />
            {!(kind === 'card' ? accounts.some(a => a.kind === 'bank') : accounts.length) && <Label muted>Add {kind === 'card' ? 'a bank account' : 'an account'} from the Accounts tab first.</Label>}
          </>}
          {kind === 'category' && <Choice label="Parent category (optional)" value={parent} options={[{ value: '', label: 'None — top-level category' }, ...options(categories.filter(c => c.parent_id === null))]} onChange={setParent} />}
          {kind === 'expense' && <>
            <Choice label="Category" value={category} options={categories.map(item => ({ value: String(item.id), label: item.parent_id ? `${categories.find(p => p.id === item.parent_id)?.name} / ${item.name}` : item.name }))} onChange={setCategory} />
            {!categories.length && <Label muted>Add a category from Settings first.</Label>}
            {!!cards.length && <Choice label="Debit card (optional)" value={card} options={[{ value: '', label: 'Account directly' }, ...options(cards)]} onChange={setCard} />}
          </>}
          {kind === 'income' && <><Choice label="Income source" value={source} options={options(sources)} onChange={setSource} />{!sources.length && <Label muted>Add an income source from Settings first.</Label>}</>}
          {kind === 'transfer' && <><Choice label="To account" value={destination} options={options(accounts.filter(a => String(a.id) !== account))} onChange={setDestination} /><Label muted>For a credit-card repayment, transfer from your bank to the credit card. Transfers do not count as spending or income.</Label></>}
          {transaction && <>
            <Field label="Amount (PKR)" value={amount} onChange={setAmount} numeric maxLength={20} />
            <Field label="Date (YYYY-MM-DD)" value={date} onChange={setDate} maxLength={10} />
            <Field label="Note (optional)" value={note} onChange={setNote} multiline maxLength={500} />
          </>}
          {!!error && <View accessibilityLiveRegion="polite"><Label style={{ color: theme.expense }}>{error}</Label></View>}
          <Action onPress={save} disabled={saved}>Save</Action><Action onPress={close}>Cancel</Action>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}
