import { createContext, use, useEffect, useSyncExternalStore } from "react";
import { useIsMounted } from "../hooks/use-is-mounted";

/** Set where a fallback above already covers loading code, so on-demand modules wait there. */
export const OnDemandWaitContext = createContext(false);

type OnDemand<T> = {
  getLoaded: () => T | null;
  /** Settles as null when its chunk can't load (offline, a stale deploy). */
  load: () => Promise<T | null>;
  /**
   * Server rendering, hydration, `wait` and an `OnDemandWaitContext` suspend until it's here;
   * elsewhere it's null while it loads.
   */
  useModule: (options?: { enabled?: boolean; wait?: boolean }) => T | null;
};

export function createOnDemand<T>(importer: () => Promise<T>): OnDemand<T> {
  const state: {
    failed: boolean;
    listeners: Set<() => void>;
    load: Promise<T | null> | null;
    loaded: T | null;
  } = { failed: false, listeners: new Set(), load: null, loaded: null };

  function load(): Promise<T | null> {
    state.load ??= importer().then(
      (module) => {
        state.loaded = module;
        state.failed = false;
        state.listeners.forEach((listener) => listener());
        return module;
      },
      () => {
        // The next load tries again; meanwhile nothing waits on code that isn't coming.
        state.failed = true;
        state.load = null;
        return null;
      },
    );

    return state.load;
  }

  function getLoaded(): T | null {
    return state.loaded;
  }

  function subscribe(listener: () => void): () => void {
    state.listeners.add(listener);
    return () => state.listeners.delete(listener);
  }

  function useModule({ enabled = true, wait }: { enabled?: boolean; wait?: boolean } = {}) {
    const loaded = useSyncExternalStore(subscribe, getLoaded, getLoaded);
    const waitsAbove = use(OnDemandWaitContext);
    const hydrating = !useIsMounted();
    const missing = enabled && !loaded;

    useEffect(() => {
      if (missing) {
        void load();
      }
    }, [missing]);

    if (missing && !state.failed && (hydrating || (wait ?? waitsAbove))) {
      // oxlint-disable-next-line typescript/only-throw-error -- Suspense's contract, as `lazy` keeps it: React waits on the thrown load, then draws again.
      throw load();
    }

    return enabled ? loaded : null;
  }

  return { getLoaded, load, useModule };
}
