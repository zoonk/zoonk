"use client";

import { createContext, use, useOptimistic, useRef, useState } from "react";

/**
 * What a request on the Plan started, held by the Plan screen above its layout switches: the
 * suggestion is drawn twice (a line under 72rem, a panel from it) and the editor is a sheet under
 * 768px and a side panel from it. Whichever copy or frame started a request, the one a resize
 * shows is busy with it and shows how it went. The Plan screen holds one per goal.
 */
type Shared = {
  busy: readonly string[];
  addBusy: (key: string) => void;
  marks: React.RefObject<Map<string, unknown>>;
  setValue: (key: string, value: unknown) => void;
  values: Readonly<Record<string, unknown>>;
};

const SharedContext = createContext<Shared | null>(null);

/** Names what a request belongs to: a suggestion, or a section of the editor. */
const ScopeContext = createContext<string | null>(null);

function addKey(current: readonly string[], key: string): readonly string[] {
  return [...current, key];
}

export function LayoutSharedProvider({ children }: { children: React.ReactNode }) {
  // Optimistic, so a request marked busy inside a form action shows at once and clears when it
  // settles, whichever copy started it.
  const [busy, addBusy] = useOptimistic<readonly string[], string>([], addKey);
  const [values, setValues] = useState<Readonly<Record<string, unknown>>>({});
  const marks = useRef(new Map<string, unknown>());

  const setValue = (key: string, value: unknown) =>
    setValues((current) => ({ ...current, [key]: value }));

  return (
    <SharedContext value={{ addBusy, busy, marks, setValue, values }}>{children}</SharedContext>
  );
}

export function RequestScope({ children, name }: { children: React.ReactNode; name: string }) {
  return <ScopeContext value={name}>{children}</ScopeContext>;
}

function useScopedKey(name: string): { key: string; shared: Shared } | null {
  const shared = use(SharedContext);
  const scope = use(ScopeContext);
  return shared && scope ? { key: `${scope}:${name}`, shared } : null;
}

/** A scope's state, the same in every copy; outside a scope it's the caller's own. */
export function useSharedState<Value>(
  name: string,
  initial: Value,
): [Value, (next: Value) => void] {
  const [own, setOwn] = useState(initial);
  const scoped = useScopedKey(name);

  if (!scoped) {
    return [own, setOwn];
  }

  const { key, shared } = scoped;

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Only this hook writes `key`, always with `Value`.
  const value = key in shared.values ? (shared.values[key] as Value) : initial;
  return [value, (next) => shared.setValue(key, next)];
}

type SharedMark<Value> = { read: () => Value; write: (value: Value) => void };

/** A value every copy reads and writes outside render, such as which request is the latest. */
export function useSharedMark<Value>(name: string, initial: Value): SharedMark<Value> {
  const own = useRef(new Map<string, unknown>());
  const scoped = useScopedKey(name);
  const marks = scoped?.shared.marks ?? own;
  const key = scoped?.key ?? name;

  return {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Only this hook writes `key`, always with `Value`.
    read: () => (marks.current.has(key) ? (marks.current.get(key) as Value) : initial),
    write: (value) => {
      marks.current.set(key, value);
    },
  };
}

/**
 * A request's busy state, the same in every copy of its scope: call `start` inside the request's
 * transition, before it awaits. Outside a scope it's the caller's own.
 */
export function useSharedRequest(
  kind: string,
  isPending: boolean,
): { busy: boolean; start: () => void } {
  const scoped = useScopedKey(`${kind}:requests`);

  if (!scoped) {
    return { busy: isPending, start: () => null };
  }

  const { key, shared } = scoped;
  return { busy: isPending || shared.busy.includes(key), start: () => shared.addBusy(key) };
}
