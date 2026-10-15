import { onLearnerIdentityChange } from "@/lib/learner/learner-pages";
import { type DayEntry, getEntryExpiry } from "./day-entry";

const registry: {
  entry: DayEntry | null;
  installed: boolean;
  listeners: Set<() => void>;
  nextId: number;
} = { entry: null, installed: false, listeners: new Set(), nextId: 1 };

function notify() {
  registry.listeners.forEach((listener) => listener());
}

/** Moves the tab's entry on, if it's still the one `id` names. */
function patch(id: number, fields: Partial<DayEntry>) {
  if (registry.entry?.id !== id) {
    return;
  }

  registry.entry = { ...registry.entry, ...fields };
  notify();
}

/** Ends the entry `id` names, or the tab's entry whichever it is (the identity changed). */
export function endDayEntry(id?: number): void {
  if (!registry.entry || (id !== undefined && registry.entry.id !== id)) {
    return;
  }

  registry.entry = null;
  notify();
}

/**
 * Lets the entry `id` names go at `expiry`, or now when that passed; only while nothing applies
 * its result (`unlessApplied`), for a result's own minute.
 */
function expireAt(id: number, expiry: number, { unlessApplied }: { unlessApplied: boolean }) {
  const expire = () => {
    if (!unlessApplied || registry.entry?.applied === false) {
      patch(id, { expired: true });
    }
  };

  const expiresIn = expiry - Date.now();

  if (expiresIn <= 0) {
    expire();
    return;
  }

  setTimeout(expire, expiresIn);
}

/**
 * Starts the tab's one entry for a tap, replacing any earlier one. It lets go on its own once the
 * day it showed ends, or a minute after its result if nothing applied it; another learner (or
 * nobody) taking the session ends it.
 */
export function beginDayEntry(
  input: Omit<DayEntry, "applied" | "expired" | "id" | "result">,
): DayEntry {
  if (!registry.installed) {
    registry.installed = true;
    onLearnerIdentityChange(() => endDayEntry());
  }

  const entry: DayEntry = {
    ...input,
    applied: false,
    expired: false,
    id: registry.nextId,
    result: null,
  };

  registry.nextId += 1;
  registry.entry = entry;
  notify();

  expireAt(
    entry.id,
    getEntryExpiry({ dayEndsAt: input.day.shown.day.dayEndsAt, settledAt: null }),
    { unlessApplied: false },
  );

  return entry;
}

/** Records the tap's result (from then on, nothing applying it lets it go), or a new address. */
export function updateDayEntry(id: number, fields: Partial<Pick<DayEntry, "href" | "result">>) {
  const dayEndsAt = registry.entry?.id === id ? registry.entry.day.shown.day.dayEndsAt : null;
  patch(id, fields);

  if (fields.result && dayEndsAt !== null) {
    expireAt(id, getEntryExpiry({ dayEndsAt, settledAt: Date.now() }), { unlessApplied: true });
  }
}

/** The session screen is applying the tap's result: it stays busy until that's done. */
export function markDayEntryApplied(id: number): void {
  patch(id, { applied: true });
}

/**
 * The tap's result opened at another address of the session screen (`href`), on the block it names
 * (the day's next step changed since the screen showed it): the entry follows, drawing that block
 * when the day it holds has it.
 */
export function moveDayEntry(id: number, { blockId, href }: { blockId?: string; href: string }) {
  const entry = registry.entry?.id === id ? registry.entry : null;

  if (!entry) {
    return;
  }

  const block = entry.day.shown.day.blocks.find(
    (candidate) => "id" in candidate && candidate.id === blockId,
  );

  patch(id, {
    href,
    step:
      block && blockId
        ? { blockId, position: block.position, ref: null, screen: "session" }
        : entry.step,
  });
}

/** Applying the tap's result failed (its lesson couldn't be asked for): the step says so, with its retry. */
export function failDayEntry(id: number): void {
  patch(id, { applied: false, result: { kind: "failed" } });
}

export function getDayEntry(): DayEntry | null {
  return registry.entry;
}

export function subscribeToDayEntry(listener: () => void): () => void {
  registry.listeners.add(listener);
  return () => registry.listeners.delete(listener);
}

/**
 * Days this tab opened, with a tap or on its own: showing their step again never opens them again.
 * The database makes a repeat harmless; this saves the request, and keeps a bare open from
 * queueing ahead of what a tap is about to show.
 */
const openedDays = new Set<string>();

/** A study day by whose it is, its goal and its learner-local date (`YYYY-MM-DD`). */
export function toDayKey({
  goalId,
  localDate,
  userId,
}: {
  goalId: string;
  localDate: Date;
  userId: string;
}): string {
  return `${userId}:${goalId}:${localDate.toISOString().slice(0, 10)}`;
}

export function markDayOpened(dayKey: string): void {
  openedDays.add(dayKey);
}

export function isDayOpened(dayKey: string): boolean {
  return openedDays.has(dayKey);
}
