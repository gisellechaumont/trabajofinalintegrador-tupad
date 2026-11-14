import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../../app/providers/SessionProvider';
import { errorMessage, isAbort } from './http';

export function useResource<T>(path: string, keepPrevious = false) {
  const { api } = useSession();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); if (!keepPrevious) setData(null);
    api.request<T>(path, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setData(result); })
      .catch((failure: unknown) => { if (!isAbort(failure) && !controller.signal.aborted) setError(errorMessage(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, revision, api, keepPrevious]);
  return { data, setData, loading, error, refresh };
}
