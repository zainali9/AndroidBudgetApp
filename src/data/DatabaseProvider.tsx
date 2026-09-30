import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import { BudgetRepository, migrate } from './storage';
import { Label } from '../components/Common';

const RepositoryContext = createContext<BudgetRepository | null>(null);
export function useRepository(): BudgetRepository {
  const repository = useContext(RepositoryContext);
  if (!repository) throw new Error('Database is not ready');
  return repository;
}
export function DatabaseProvider({ children }: PropsWithChildren) {
  const [repository, setRepository] = useState<BudgetRepository | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let close: (() => Promise<void>) | undefined;
    openDatabaseAsync('budget.db').then(async db => {
      if (cancelled) { await db.closeAsync(); return; }
      close = () => db.closeAsync();
      migrate(db);
      if (!cancelled) setRepository(new BudgetRepository(db));
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; void close?.().catch(() => undefined); };
  }, [attempt]);
  if (!repository) return <View style={{ flex: 1, justifyContent: 'center', padding: 28, gap: 16 }}>
    <Label>{failed ? 'Could not open your local storage. Your records have not been reset.' : 'Opening local storage…'}</Label>
    {failed && <Pressable accessibilityRole="button" onPress={() => { setFailed(false); setAttempt(value => value + 1); }} style={{ padding: 16 }}><Label>Try again</Label></Pressable>}
  </View>;
  return <RepositoryContext.Provider value={repository}>{children}</RepositoryContext.Provider>;
}
