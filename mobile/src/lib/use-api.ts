import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from './api';

/**
 * Minimal fetch-on-mount hook. `refresh()` refetches (pull-to-refresh) and
 * keeps the previous data visible while loading.
 * shortcut: no cache shared between screens; add TanStack Query if screens start refetching the same data.
 */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const latest = useRef(path);
  latest.current = path;

  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      const res = await api<T>(path);
      if (latest.current === path) {
        setData(res);
        setError(null);
      }
    } catch (e) {
      if (latest.current === path) setError(e as Error);
    } finally {
      if (latest.current === path) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, loading, refresh: load, setData };
}
