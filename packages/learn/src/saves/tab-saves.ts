"use client";

import { useSyncExternalStore } from "react";

type States = ReadonlyMap<string, boolean>;

/** What every page in this tab shows for each save: the learner's tap on its way, or what the server stored. */
type TabSaves = { stored: States; wanted: States };

/** A tap on its way: how to send what it asks for, and how the page that asked hears how it ended. */
type Tap = {
  onFailed: (saved: boolean) => void;
  onStored: (saved: boolean) => void;
  saved: boolean;
  send: (saved: boolean) => Promise<boolean | null>;
};

const NONE: TabSaves = { stored: new Map(), wanted: new Map() };

let saves = NONE;

/** Each thing's newest tap while one of its requests is out, whichever page it was made on. */
const taps = new Map<string, Tap>();

const listeners = new Set<() => void>();

/** Tells the browser's other tabs what the server stored; a channel never hears its own messages. */
let channel: BroadcastChannel | null | undefined;

function change(next: Partial<TabSaves>) {
  saves = { ...saves, ...next };
  listeners.forEach((notify) => notify());
}

function isStoredSave(data: unknown): data is { key: string; saved: boolean } {
  return (
    typeof data === "object" &&
    data !== null &&
    "key" in data &&
    typeof data.key === "string" &&
    "saved" in data &&
    typeof data.saved === "boolean"
  );
}

function getChannel(): BroadcastChannel | null {
  if (channel === undefined) {
    channel = "BroadcastChannel" in globalThis ? new BroadcastChannel("zoonk-saves") : null;

    // Only for saves made here: the rest come from pages read after the write, the phone's included.
    channel?.addEventListener("message", ({ data }: MessageEvent<unknown>) => {
      if (isStoredSave(data) && saves.stored.has(data.key)) {
        change({ stored: new Map(saves.stored).set(data.key, data.saved) });
      }
    });
  }

  return channel;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function without(states: States, key: string): States {
  return new Map([...states].filter(([other]) => other !== key));
}

function settle(key: string) {
  taps.delete(key);
  change({ wanted: without(saves.wanted, key) });
}

async function send(key: string, last: boolean): Promise<void> {
  const tap = taps.get(key);

  if (tap === undefined || tap.saved === last) {
    settle(key);
    return;
  }

  const result = await tap.send(tap.saved).catch(() => null);

  if (result === null) {
    const newest = taps.get(key) ?? tap;
    settle(key);
    newest.onFailed(newest.saved);
    return;
  }

  change({ stored: new Map(saves.stored).set(key, result) });
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- A BroadcastChannel has no target origin.
  getChannel()?.postMessage({ key, saved: result });
  tap.onStored(result);
  await send(key, result);
}

/**
 * Flips `key` from what it shows now and sends it, one request at a time for each thing in this
 * tab, whichever page each tap was on: the server takes them in the order they were made, so quick
 * taps end on the last one. A failure goes back to what the server last stored, or `served`, and
 * tells the page of the newest tap.
 */
export function toggleSave(
  key: string,
  { served, ...tap }: Omit<Tap, "saved"> & { served: boolean },
) {
  const isSending = taps.has(key);
  const from = saves.stored.get(key) ?? served;
  const saved = !(taps.get(key)?.saved ?? from);

  taps.set(key, { ...tap, saved });
  change({ wanted: new Map(saves.wanted).set(key, saved) });

  if (!isSending) {
    void send(key, from);
  }
}

/**
 * What every page in this tab shows for the saves made in it, kept current by the other tabs: newer
 * than a copy of a page the router kept from before them. Signing out reloads the page, which
 * forgets them.
 */
export function useTabSaves(): TabSaves {
  return useSyncExternalStore(
    subscribe,
    () => saves,
    () => NONE,
  );
}
