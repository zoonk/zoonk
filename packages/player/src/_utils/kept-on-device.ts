import { deviceStorage } from "@zoonk/learn/device-storage";

/** Values the browser wouldn't keep (blocked or full storage): they last until the page reloads. */
const unkept = new Map<string, string | null>();
const listeners = new Set<() => void>();

export function subscribeToKept(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A value this device keeps, or this page's when the browser wouldn't keep it. */
export function readKept(key: string): string | null {
  return unkept.has(key) ? (unkept.get(key) ?? null) : deviceStorage.get(key);
}

/** Keeps a value on this device (null removes it), or for this page when the browser won't. */
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
