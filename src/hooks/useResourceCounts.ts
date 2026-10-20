import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { CacheManager } from '../utils/query-cache';
import { eventBus } from '../utils/EventBus';

export function useResourceCounts<T>(
  query: () => Promise<T>,
  resource: string,
  refreshInterval: number
) {
  const { user, session } = useAuth();
  const authenticated = Boolean(user && session?.user.id === user.id);
  const permissions = (user as { role?: { permissions?: unknown } } | null)?.role?.permissions;
  const identity = JSON.stringify([session?.access_token, user?.id, user?.role_id, permissions, user?.is_active]);
  const [snapshot, setSnapshot] = useState<{ identity: string; counts: T } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const mounted = useRef(false);

  const fetchCounts = useCallback(async () => {
    if (!authenticated) return;
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const counts = await query();
      if (mounted.current && version === requestVersion.current) setSnapshot({ identity, counts });
    } catch (failure) {
      if (mounted.current && version === requestVersion.current) {
        setError(failure instanceof Error ? failure.message : 'حدث خطأ في جلب الإحصائيات');
      }
    } finally {
      if (mounted.current && version === requestVersion.current) setLoading(false);
    }
  }, [identity, query, authenticated]);

  const refresh = useCallback(async () => {
    CacheManager.invalidate(`enhanced:${resource}:counts`);
    await fetchCounts();
  }, [fetchCounts, resource]);

  useEffect(() => {
    mounted.current = true;
    void fetchCounts();
    const timer = setInterval(() => { void fetchCounts(); }, refreshInterval);
    const unsubscribe = eventBus.on(`${resource}:changed`, fetchCounts);
    return () => {
      mounted.current = false;
      requestVersion.current++;
      clearInterval(timer);
      unsubscribe();
    };
  }, [fetchCounts, refresh, refreshInterval, resource, identity]);

  return { counts: authenticated && snapshot?.identity === identity ? snapshot.counts : null, loading, error, refresh };
}
