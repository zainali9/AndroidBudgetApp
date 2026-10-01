import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { FormSheet } from '../components/FormSheet';
import { useRepository } from '../data/DatabaseProvider';
import { Category, parsePkr } from '../data/storage';
import { monthLabel } from '../sampleData';
import { Label } from '../components/Common';
import { Action, Choice, Field } from '../components/FormControls';

const rupees = (amount: number) => `${Math.floor(amount / 100)}.${String(amount % 100).padStart(2, '0')}`;
const friendlyMonth = (key: string) => { const [year, month] = key.split('-').map(Number); return monthLabel(year * 12 + month - 1); };
const message = (error: unknown) => error instanceof Error && !/sqlite|constraint/i.test(error.message) ? error.message : 'Could not save. Your existing records were kept.';

export function BudgetForm({ month, onClose, onSaved }: { month: string; onClose: () => void; onSaved: () => void }) {
  const repo = useRepository();
  const roots = repo.categories().filter(c => c.parent_id === null);
  const initial = useRef(Object.fromEntries(repo.budgetPlans(month).map(p => [p.categoryId, rupees(p.amount)])));
  const [amounts, setAmounts] = useState<Record<string, string>>(initial.current);
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const saving = useRef(false);
  const pastMonths = repo.budgetMonths().filter(key => key < month);
  const dirty = roots.some(c => (amounts[c.id] ?? '') !== (initial.current[c.id] ?? ''));
  const copy = () => {
    const apply = () => {
      try { setAmounts(Object.fromEntries(repo.budgetPlans(source).map(p => [p.categoryId, rupees(p.amount)]))); setError(''); }
      catch (err) { setError(message(err)); }
    };
    if (Object.values(amounts).some(value => value.trim())) Alert.alert('Replace this draft?', 'The copied allocations replace the amounts below. Expenses and account balances stay the same. Tap Save plan to apply the draft.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Replace draft', onPress: apply },
    ]); else apply();
  };
  const save = () => {
    if (saving.current) return;
    saving.current = true;
    try {
      const plans = roots.filter(c => (amounts[c.id] ?? '').trim() !== '').map(c => ({ categoryId: c.id, amount: parsePkr(amounts[c.id]) }));
      repo.saveBudget(month, plans); onSaved();
    } catch (err) { setError(message(err)); saving.current = false; }
  };
  return <FormSheet title={`Plan for ${friendlyMonth(month)}`} dirty={dirty} onClose={onClose}>
    <Label muted>Set limits for top-level categories. Each limit includes its subcategories. Leave a field blank for no budget; enter 0 for an explicit zero limit.</Label>
    {!!pastMonths.length && <View style={{ gap: 10 }}>
      <Choice label="Copy from a past month" value={source} options={pastMonths.map(key => ({ value: key, label: friendlyMonth(key) }))} onChange={setSource} />
      <Action disabled={!source} onPress={copy}>Copy into draft</Action>
      <Label muted>Only planned amounts are copied. Unspent money and expenses are not carried forward.</Label>
    </View>}
    {roots.length ? roots.map(c => <Field key={c.id} label={`${c.name} budget (PKR)`} value={amounts[c.id] ?? ''} onChange={value => setAmounts(previous => ({ ...previous, [c.id]: value }))} numeric />)
      : <Label>Add a top-level category in Settings before planning.</Label>}
    {!!error && <Label>{error}</Label>}
    <Action disabled={!roots.length} onPress={save}>Save plan</Action>
  </FormSheet>;
}

export function CategoryForm({ category, onClose, onSaved }: { category: Category; onClose: () => void; onSaved: () => void }) {
  const repo = useRepository();
  const [name, setName] = useState(category.name);
  const [parent, setParent] = useState(String(category.parent_id ?? ''));
  const [error, setError] = useState('');
  const saving = useRef(false);
  const parentChanged = parent !== String(category.parent_id ?? '');
  const save = () => {
    if (saving.current) return;
    saving.current = true;
    try { repo.updateCategory(category.id, name, parent ? Number(parent) : null); onSaved(); }
    catch (err) { setError(message(err)); saving.current = false; }
  };
  const confirm = () => parentChanged ? Alert.alert('Change category grouping?', 'Existing expenses will be grouped under the new parent (or this category if top-level), including past months. Existing budget amounts will stay with their current categories. Transaction amounts and account balances stay the same.', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Save change', onPress: save },
  ]) : save();
  return <FormSheet title="Edit category" dirty={name !== category.name || parentChanged} onClose={onClose}>
    <Field label="Category name" value={name} onChange={setName} />
    <Choice label="Parent category" value={parent} onChange={setParent} options={[
      { value: '', label: 'None (top-level)' },
      ...repo.categories().filter(c => c.parent_id === null && c.id !== category.id).map(c => ({ value: String(c.id), label: c.name })),
    ]} />
    <Label muted>Renaming keeps all linked expenses. Before moving a top-level category, move its subcategories and clear its saved monthly budget allocations.</Label>
    {!!error && <Label>{error}</Label>}
    <Action onPress={confirm}>Save category</Action>
  </FormSheet>;
}
