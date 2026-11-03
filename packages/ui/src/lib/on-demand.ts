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
  /**
   * Suspends until it's here. When the load it waited on fails, it throws that error to the nearest
   * error boundary; an earlier failed load, such as a preload, only makes it try again.
   */
  useRequiredModule: () => T;
};

type Failure = { error: unknown };

export function createOnDemand<T>(importer: () => Promise<T>): OnDemand<T> {
  const state: {
    failure: Failure | null;
    listeners: Set<() => void>;
    load: Promise<T | null> | null;
    loaded: T | null;
    waitedFailure: Failure | null;
  } = { failure: null, listeners: new Set(), load: null, loaded: null, waitedFailure: null };

  function load(): Promise<T | null> {
    if (!state.load) {
      state.waitedFailure = null;

      state.load = importer().then(
        (module) => {
          state.loaded = module;
          state.failure = null;
          state.listeners.forEach((listener) => listener());
          return module;
        },
        (error: unknown) => {
          // The next load tries again; meanwhile nothing waits on code that isn't coming.
          state.failure = { error };
          state.load = null;
          return null;
        },
      );
    }

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

    if (missing && !state.failure && (hydrating || (wait ?? waitsAbove))) {
      // oxlint-disable-next-line typescript/only-throw-error -- Suspense's contract, as `lazy` keeps it: React waits on the thrown load, then draws again.
      throw load();
    }

    return enabled ? loaded : null;
  }

  async function waitForLoad() {
    if (!(await load())) {
      state.waitedFailure = state.failure;
    }
  }

  function useRequiredModule(): T {
    const loaded = useSyncExternalStore(subscribe, getLoaded, getLoaded);

    if (loaded) {
      return loaded;
    }

    if (state.waitedFailure) {
      throw state.waitedFailure.error;
    }

    // oxlint-disable-next-line typescript/only-throw-error -- Suspense's contract, as in useModule.
    throw waitForLoad();
  }

  return { getLoaded, load, useModule, useRequiredModule };
}
