import { type DayEntry, getEntryExpiry } from "./day-entry";

const registry: { entry: DayEntry | null; listeners: Set<() => void>; nextId: number } = {
  entry: null,
  listeners: new Set(),
  nextId: 1,
};

function notify() {
  registry.listeners.forEach((listener) => listener());
}

function patch(id: number, fields: Partial<DayEntry>) {
  if (registry.entry?.id !== id) {
    return;
  }

  registry.entry = { ...registry.entry, ...fields };
  notify();
}

export function endDayEntry(id?: number): void {
  if (!registry.entry || (id !== undefined && registry.entry.id !== id)) {
    return;
  }

  registry.entry = null;
  notify();
}

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

export function beginDayEntry(
  input: Omit<DayEntry, "applied" | "expired" | "id" | "result">,
): DayEntry {
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

export function updateDayEntry(id: number, fields: Partial<Pick<DayEntry, "href" | "result">>) {
  const dayEndsAt = registry.entry?.id === id ? registry.entry.day.shown.day.dayEndsAt : null;
  patch(id, fields);

  if (fields.result && dayEndsAt !== null) {
    expireAt(id, getEntryExpiry({ dayEndsAt, settledAt: Date.now() }), { unlessApplied: true });
  }
}

export function markDayEntryApplied(id: number): void {
  patch(id, { applied: true });
}

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
