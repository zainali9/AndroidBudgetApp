import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { Account, DebitCard, IncomeSource, parsePkr } from '../data/storage';
import { useRepository } from '../data/DatabaseProvider';
import { FormSheet } from '../components/FormSheet';
import { Action, Choice, Field } from '../components/FormControls';
import { Label } from '../components/Common';
import { pkr } from '../sampleData';
import { useTheme } from '../theme';

export type SetupTarget = { kind: 'account'; record: Account } | { kind: 'card'; record: DebitCard } | { kind: 'source'; record: IncomeSource };
const titles = { account: 'Edit account', card: 'Edit debit card', source: 'Edit income source' };
const amountText = (value: number) => `${Math.floor(Math.abs(value) / 100)}.${String(Math.abs(value) % 100).padStart(2, '0')}`;
const balanceText = (value: number, account: Account) => account.kind === 'credit'
  ? `${pkr(Math.abs(value))} ${value < 0 ? 'owed' : 'credit in your favor'}`
  : `${pkr(value)}${value < 0 ? ' (negative balance)' : ''}`;

export function SetupForm({ target, onClose, onSaved }: { target: SetupTarget; onClose: () => void; onSaved: () => void }) {
  const repo = useRepository();
  const theme = useTheme();
  const account = target.kind === 'account' ? target.record : null;
  const initialAmount = account ? amountText(account.opening) : '';
  const initialSign = account && account.opening < 0 ? 'negative' : 'positive';
  const [name, setName] = useState(target.record.name);
  const [amount, setAmount] = useState(initialAmount);
  const [sign, setSign] = useState(initialSign);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const dirty = name !== target.record.name || amount !== initialAmount || sign !== initialSign;
  const draftOpening = () => parsePkr(amount) * (sign === 'negative' ? -1 : 1);
  let preview: number | null = null;
  if (account) {
    try { preview = repo.previewOpeningBalance(account.id, draftOpening()); } catch { /* Save explains invalid input. */ }
  }
  const report = (problem: unknown) => {
    const message = problem instanceof Error ? problem.message : '';
    setError(/sqlite|constraint|database/i.test(message) ? 'Could not save. Your existing records were kept.' : message || 'Could not save. Please try again.');
    saving.current = false; setBusy(false);
  };
  const save = () => {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      if (!name.trim() || name.trim().length > 100) throw new Error('Name must contain 1 to 100 characters');
      const opening = account ? draftOpening() : 0;
      const proposed = account ? repo.previewOpeningBalance(account.id, opening) : 0;
      const apply = () => {
        try {
          if (target.kind === 'account') repo.updateAccount(target.record.id, name, opening);
          else if (target.kind === 'card') repo.renameDebitCard(target.record.id, name);
          else repo.renameIncomeSource(target.record.id, name);
          onSaved();
        } catch (problem) { report(problem); }
      };
      if (account && opening !== account.opening) Alert.alert('Correct opening balance?',
        `Opening balance: ${balanceText(account.opening, account)} → ${balanceText(opening, account)}.\n\nCurrent balance after saving: ${balanceText(proposed, account)}.\n\nThis corrects the starting balance before your recorded transactions. It does not record income, spending, or a repayment.`, [
          { text: 'Keep editing', style: 'cancel', onPress: () => { saving.current = false; setBusy(false); } },
          { text: 'Save correction', onPress: apply },
        ]);
      else apply();
    } catch (problem) { report(problem); }
  };
  return <FormSheet title={titles[target.kind]} dirty={dirty} onClose={onClose}>
    <Field label="Name" value={name} onChange={setName} />
    {account && <>
      <Label>Account type: {account.kind === 'credit' ? 'Credit card' : account.kind === 'bank' ? 'Bank' : 'Cash'}</Label>
      <Label muted>Account type is fixed to preserve how existing transactions are interpreted.</Label>
      <Field label="Opening amount (PKR)" value={amount} onChange={setAmount} numeric maxLength={20} />
      <Choice label="Opening balance meaning" value={sign} onChange={setSign} options={[
        { value: 'positive', label: account.kind === 'credit' ? 'Credit in your favor' : 'Available money' },
        { value: 'negative', label: account.kind === 'credit' ? 'Amount owed' : 'Overdraft / negative balance' },
      ]} />
      <Label muted>Correct the balance from before your recorded transactions. For new money received, a purchase, or a card repayment, add a transaction instead.</Label>
      <Label>Current balance: {balanceText(repo.balance(account.id), account)}</Label>
      <Label>{preview === null ? 'Enter a valid opening amount to preview the corrected balance.' : `After saving: ${balanceText(preview, account)}`}</Label>
    </>}
    {target.kind === 'card' && <><Label>Linked bank: {repo.account(target.record.account_id).name}</Label><Label muted>The bank link stays fixed so past purchases continue to use their original account.</Label></>}
    <Label muted>Renaming updates labels on existing transactions while keeping their links.</Label>
    {!!error && <View accessibilityLiveRegion="polite"><Label style={{ color: theme.expense }}>{error}</Label></View>}
    <Action onPress={save} disabled={busy}>Save changes</Action>
  </FormSheet>;
}
