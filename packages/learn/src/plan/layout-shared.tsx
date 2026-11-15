"use client";

import { createContext, use, useMemo, useRef, useState, useSyncExternalStore } from "react";

/**
 * State held above a layout switch: the Plan's suggestion is drawn twice (a line under 72rem, a
 * panel from it) and its editor is a sheet under 768px and a side panel from it. What a request
 * started lives here, so the copy or frame a resize shows is still busy with it and shows how it
 * went, whichever started it and even once that one is gone.
 */

/**
 * Kept outside React state, so an update made inside a transition (a form action) shows at once
 * rather than when the transition ends.
 */
type Shared = {
  marks: Map<string, { current: unknown }>;
  read: (key: string) => unknown;
  subscribe: (listener: () => void) => () => void;
  update: (key: string, next: (current: unknown) => unknown) => void;
};

function createShared(): Shared {
  const values = new Map<string, unknown>();
  const listeners = new Set<() => void>();

  return {
    marks: new Map(),
    read: (key) => values.get(key),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update: (key, next) => {
      const value = next(values.get(key));

      if (Object.is(values.get(key), value)) {
        return;
      }

      values.set(key, value);

      for (const listener of listeners) {
        listener();
      }
    },
  };
}

const SharedContext = createContext<Shared | null>(null);

/** Names the suggestion whose copies share their state. */
const ItemContext = createContext<string | null>(null);

/** Names what a request belongs to: a suggestion, or a section of the editor. */
const ScopeContext = createContext<string | null>(null);

export function LayoutSharedProvider({ children }: { children: React.ReactNode }) {
  const shared = useMemo(() => createShared(), []);
  return <SharedContext value={shared}>{children}</SharedContext>;
}

/** Read when there's no provider: always empty. */
const NO_STORE = createShared();

/** The stored value under `key`, read again whenever the store changes. */
function useStored(shared: Shared | null, key: string | null): unknown {
  const store = shared ?? NO_STORE;
  const read = () => (key ? store.read(key) : null);
  return useSyncExternalStore(store.subscribe, read, read);
}

/** A suggestion: its copies share their state, and its requests are its own. */
export function SharedItem({ children, itemKey }: { children: React.ReactNode; itemKey: string }) {
  return (
    <ItemContext value={itemKey}>
      <ScopeContext value={itemKey}>{children}</ScopeContext>
    </ItemContext>
  );
}

/** A part whose requests are its own, such as a section of the editor. */
export function RequestScope({ children, name }: { children: React.ReactNode; name: string }) {
  return <ScopeContext value={name}>{children}</ScopeContext>;
}

function useItemKey(name: string): { key: string; shared: Shared } | null {
  const shared = use(SharedContext);
  const item = use(ItemContext);
  return shared && item ? { key: `${item}:${name}`, shared } : null;
}

type SetSharedState<Value> = (next: Value | ((current: Value) => Value)) => void;

function isUpdater<Value>(
  next: Value | ((current: Value) => Value),
): next is (current: Value) => Value {
  return typeof next === "function";
}

/** A suggestion's state, the same in both copies; anywhere else it's the caller's own. */
export function useSharedState<Value>(
  name: string,
  initial: Value,
): [Value, SetSharedState<Value>] {
  const [own, setOwn] = useState(initial);
  const item = useItemKey(name);
  const stored = useStored(item?.shared ?? null, item?.key ?? null);

  if (!item) {
    return [own, setOwn];
  }

  const { key, shared } = item;

  const read = (value: unknown): Value => {
    if (value === undefined || value === null) {
      return initial;
    }

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Only this hook writes `key`, always with `Value`.
    return value as Value;
  };

  return [
    read(stored),
    (next) => shared.update(key, (current) => (isUpdater(next) ? next(read(current)) : next)),
  ];
}

type SharedMark<Value> = { read: () => Value; write: (value: Value) => void };

/** A value both copies read and write outside render, such as which request is the latest. */
export function useSharedMark<Value>(name: string, initial: Value): SharedMark<Value> {
  const own = useRef(initial);
  const item = useItemKey(name);

  if (!item) {
    return {
      read: () => own.current,
      write: (value) => {
        own.current = value;
      },
    };
  }

  const { key, shared } = item;

  const box = () => {
    const found = shared.marks.get(key) ?? { current: initial };
    shared.marks.set(key, found);
    return found;
  };

  return {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Only this hook stores `key`, always with `Value`.
    read: () => box().current as Value,
    write: (value) => {
      box().current = value;
    },
  };
}

function countOf(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

/**
 * A request's busy state, held above the switch: `track` counts the request until it settles, so
 * every copy or frame of its scope is busy with that kind of request meanwhile. Outside a scope
 * it's the caller's own.
 */
export function useSharedRequest(
  kind: string,
  isPending: boolean,
): { busy: boolean; track: <Result>(request: Promise<Result>) => Promise<Result> } {
  const shared = use(SharedContext);
  const scope = use(ScopeContext);
  const key = scope ? `${scope}:${kind}:requests` : null;
  const count = countOf(useStored(shared, key));

  if (!shared || !key) {
    return { busy: isPending, track: (request) => request };
  }

  return {
    busy: isPending || count > 0,
    track: (request) => {
      shared.update(key, (current) => countOf(current) + 1);
      const settle = () => shared.update(key, (current) => Math.max(0, countOf(current) - 1));
      request.then(settle, settle);
      return request;
    },
  };
}
