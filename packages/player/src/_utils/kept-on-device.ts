import { deviceStorage } from "@zoonk/learn/device-storage";

const unkept = new Map<string, string | null>();
const listeners = new Set<() => void>();

export function subscribeToKept(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Returns the page-local fallback when browser storage is blocked or full. */
export function readKept(key: string): string | null {
  return unkept.has(key) ? (unkept.get(key) ?? null) : deviceStorage.get(key);
}

/** Passing null removes the value; blocked storage falls back to this page until reload. */
export function keep(key: string, value: string | null): void {
  const kept = value === null ? deviceStorage.remove(key) : deviceStorage.set(key, value);

  if (kept) {
    unkept.delete(key);
  } else {
    unkept.set(key, value);
  }

  for (const listener of listeners) {
    listener();
  }
}
