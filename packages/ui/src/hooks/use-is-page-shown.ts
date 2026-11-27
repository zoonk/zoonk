import { useLayoutEffect, useMemo, useSyncExternalStore } from "react";

function createShownStore() {
  const listeners = new Set<() => void>();
  let shown = true;

  return {
    get: () => shown,
    set: (next: boolean) => {
      shown = next;

      for (const notify of listeners) {
        notify();
      }
    },
    subscribe: (notify: () => void) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
  };
}

/**
 * Next.js keeps a page the learner left mounted but hidden (React Activity), and runs its layout
 * effects only while it shows. False on a hidden page, for a part that draws state shared with the
 * page in view and so would draw a second copy of it. It turns true again before the page paints.
 */
export function useIsPageShown(): boolean {
  const store = useMemo(() => createShownStore(), []);

  useLayoutEffect(() => {
    store.set(true);
    return () => store.set(false);
  }, [store]);

  return useSyncExternalStore(store.subscribe, store.get, () => true);
}
