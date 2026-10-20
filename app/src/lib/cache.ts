type Entry<T> = { at: number; value: T };
const g = globalThis as unknown as { __orcaMemo?: Map<string, Entry<unknown>>; __orcaMemoInflight?: Map<string, Promise<unknown>> };
const store: Map<string, Entry<unknown>> = (g.__orcaMemo ??= new Map());
const inflight: Map<string, Promise<unknown>> = (g.__orcaMemoInflight ??= new Map());

/**
 * Caches an async result for `ttlMs`, shares one in-flight call between concurrent callers, and serves the last
 * good value if a refresh fails. Used for the public live widgets so a crowd never multiplies upstream requests.
 */
export async function memo<T>(key: string, ttlMs: number, fn: () => Promise<T>, now = () => Date.now()): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && now() - hit.at < ttlMs) return hit.value;
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;
  const p = fn()
    .then((value) => {
      store.set(key, { at: now(), value });
      return value;
    })
    .catch((e) => {
      if (hit) return hit.value;
      throw e;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
