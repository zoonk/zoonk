import { type PlanItem } from "@zoonk/db";

type BossItem = Pick<PlanItem, "kind" | "phase" | "position" | "scheduledFor" | "status">;

type SessionItem = BossItem & Pick<PlanItem, "id">;

/** `nextSession` is due next; `queued` waits for an earlier phase; `date` uses the saved day. */
export type BossTiming = "date" | "nextSession" | "queued";

/** The saved day leaves a day between learning and testing; completing lessons early must re-plan it. */
export function isBossReached({ boss, today }: { boss: BossItem; today: Date }): boolean {
  return (
    boss.kind === "boss" &&
    boss.status === "todo" &&
    boss.scheduledFor !== null &&
    boss.scheduledFor <= today
  );
}

/** Requires items in plan order. */
export function findSessionBosses<Item extends BossItem>({
  items,
  today,
}: {
  items: readonly Item[];
  today: Date;
}): Item[] {
  const first = items.find((boss) => isBossReached({ boss, today }));

  if (!first) {
    return [];
  }

  const later = items.filter(
    (boss) =>
      boss.kind === "boss" &&
      boss.status === "todo" &&
      boss.phase > first.phase &&
      boss.scheduledFor !== null &&
      boss.scheduledFor <= today,
  );

  return [first, ...later.toSorted((a, b) => a.phase - b.phase)];
}

export function getBossTimings({
  items,
  today,
}: {
  items: readonly SessionItem[];
  today: Date;
}): ReadonlyMap<string, BossTiming> {
  const ordered = items.toSorted((a, b) => a.position - b.position);
  const next = new Set(findSessionBosses({ items: ordered, today }).map((boss) => boss.id));

  return new Map(
    ordered.flatMap((boss): [string, BossTiming][] => {
      if (boss.kind !== "boss" || boss.status !== "todo") {
        return [];
      }

      if (next.has(boss.id)) {
        return [[boss.id, "nextSession"]];
      }

      return [[boss.id, isBossReached({ boss, today }) ? "queued" : "date"]];
    }),
  );
}
