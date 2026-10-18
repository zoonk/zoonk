import { type PlanItem } from "@zoonk/db";

type BossItem = Pick<PlanItem, "kind" | "phase" | "position" | "scheduledFor" | "status">;

type SessionItem = BossItem & Pick<PlanItem, "id">;

/**
 * When a phase challenge still to win comes: `nextSession` when the learner's next session duels
 * it (see `findSessionBosses`); `queued` when its day came but one before it comes first, since a
 * session duels one reached challenge and the next once it's won; `date` on its day otherwise.
 */
export type BossTiming = "date" | "nextSession" | "queued";

/**
 * The boss that closes a phase is reached on the day the plan saved it: the first study day after
 * the lessons it tests, so a day passes between learning and being tested (see `placeBoss`). Done
 * early, its lessons bring it sooner through the plan's next run, which saves its new day and the
 * day's time with it, so Today, its card and its start all read the same day.
 */
export function isBossReached({ boss, today }: { boss: BossItem; today: Date }): boolean {
  return (
    boss.kind === "boss" &&
    boss.status === "todo" &&
    boss.scheduledFor !== null &&
    boss.scheduledFor <= today
  );
}

/**
 * The bosses the learner's next session duels: the first one reached, then any later phase's whose
 * day came too, earlier phase first. A half-studied day left one phase's challenge, and the next
 * phase still ends today as the learner saw it (R6): asked alone, the first pushed the second a
 * day and moved that phase's end. `items` in plan order.
 */
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

/**
 * When each phase challenge still to win comes (see `BossTiming`), by its plan item, as sessions
 * offer them: the Plan's path and the challenge's page say the same. Every lesson done, Pedro's
 * later challenges read the days the plan gave them, though each came the session after the one
 * before; away a few days, they read days already gone while his next session had them all.
 */
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
