import { createContext, use, useEffect, useSyncExternalStore } from "react";
import { useIsMounted } from "../hooks/use-is-mounted";

/**
 * Set where a fallback above already covers code still loading (a conversation's skeleton on its
 * first look): an on-demand module waits for its code there instead of drawing without it.
 */
export const OnDemandWaitContext = createContext(false);

type OnDemand<T> = {
  /** The module once it's here; null before. */
  getLoaded: () => T | null;
  /** Starts loading it, once; settles as null when its chunk can't load (offline, a stale deploy). */
  load: () => Promise<T | null>;
  /**
   * The module once it's here. Before that, server rendering and hydration wait for it (the HTML
   * is drawn with it), and so does a screen where `wait` is true, or, by default, inside an
   * `OnDemandWaitContext`; anywhere else it's null for that moment while it loads. Not `enabled`,
   * it's null and never loads.
   */
  useModule: (options?: { enabled?: boolean; wait?: boolean }) => T | null;
};

/**
 * Code a screen needs only sometimes, in its own chunk: loaded on demand or ahead (`load`), and
 * drawn at once once it's here.
 *
 * ```ts
 * const renderer = createOnDemand(() => import("./tutor-markdown"));
 * ```
 */
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
    // The server renders with the module (it waits for it), so hydration reads it the same way.
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
