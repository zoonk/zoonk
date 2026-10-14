import { type BossMinutes, getPlannedBossMinutes } from "./boss-minutes";
import { type BuildPlanInput } from "./build-plan";
import { listCheckpointOverflow } from "./checkpoint-overflow";
import { type ExamBossDays } from "./exam-boss-days";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlannedItem } from "./plan-items";
import { type PlanPhase, type PlanSettings } from "./plan-state";

/** What the fallback needs of a built plan, and gives back (see `settleTeachingFirst`). */
export type SettlingPlan = {
  estimate: { endDate: Date | null; remainingMinutes: number; totalMinutes: number };
  items: PlannedItem[];
  keptKeys: ReadonlySet<string>;
  lessonRawMinutes: ReadonlyMap<string, ReadonlyMap<string, number>>;
  mockFunding: PlanSettings["mockFunding"];
  phases: PlanPhase[];
  skillLessons: ReadonlyMap<string, number>;
  studyDays: string[];
  teachingEnds: ReadonlyMap<string, Date>;
};

/** Why a plan's bosses were placed by the fallback, for the warning its run logs. */
export type BossFallback = { iterations: number; reason: "unsettled" };

function sumMinutes(items: readonly PlannedItem[]): number {
  return items.reduce((total, item) => total + item.minutes, 0);
}

/**
 * The plan's items with each boss on its day, at its minutes: leading the day, after the work
 * already done and before the day's new lessons, or beside them, after the day's items.
 */
function putBosses({
  bosses,
  items,
}: {
  bosses: readonly (PlannedItem & { beside: boolean })[];
  items: readonly PlannedItem[];
}): PlannedItem[] {
  const placed = items.filter((item) => item.kind !== "boss");

  const byDay = bosses.toSorted(
    (a, b) => (a.scheduledFor?.getTime() ?? 0) - (b.scheduledFor?.getTime() ?? 0),
  );

  for (const { beside, ...boss } of byDay) {
    const day = boss.scheduledFor?.getTime() ?? 0;

    const at = placed.findIndex((item) => {
      const date = item.scheduledFor?.getTime();

      return (
        date !== undefined && (date > day || (!beside && date === day && item.status === "todo"))
      );
    });

    placed.splice(at === -1 ? placed.length : at, 0, boss);
  }

  return placed;
}

/** The day's time each fallback boss takes past it, with what the rest of the day's checkpoints take. */
function addBossOverflow({
  base,
  bosses,
}: {
  base: PlanSettings["checkpointOverflow"];
  bosses: readonly PlannedItem[];
}): PlanSettings["checkpointOverflow"] {
  const days = new Map(base.map((entry) => [entry.date, entry.minutes]));

  bosses.forEach((boss) => {
    const date = boss.scheduledFor ? toIsoDate(boss.scheduledFor) : null;

    if (date && boss.minutes > 0) {
      days.set(date, (days.get(date) ?? 0) + boss.minutes);
    }
  });

  return [...days]
    .map(([date, minutes]) => ({ date, minutes }))
    .toSorted((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * A plan whose bosses didn't settle (see `settlePlannedBosses`), placed without moving its teaching
 * again: built once with every boss taking none of its day's time, its lessons, mocks' funding,
 * past credits and phase windows stay as that build has them; each boss then goes on the first study
 * day after the lessons it tests end, or beside them on their last day (see `placeExamBosses`), at
 * the time its session plays, all of it asked of its day on top (`checkpointOverflow`), as Today
 * and the Plan show it. An entrance exam's what-if at 5 minutes a day crashed the Plan instead.
 */
export function settleTeachingFirst<T extends SettlingPlan>({
  bossDays,
  build,
  input,
  iterations,
  places,
  size,
}: {
  bossDays: ExamBossDays | undefined;
  build: (input: BuildPlanInput) => T;
  input: BuildPlanInput;
  iterations: number;
  /** Where an exam's bosses go on a plan's fixed teaching (see `placeExamBosses`). */
  places: ((built: T) => ExamBossDays) | null;
  /** What each boss runs, read from the plan's items (see `sizePlannedBosses`). */
  size: (built: T, items: readonly PlannedItem[]) => BossMinutes;
}): T & { bossFallback: BossFallback; checkpointOverflow: PlanSettings["checkpointOverflow"] } {
  const keys = [...(bossDays?.keys() ?? []), ...(input.bossMinutes?.keys() ?? [])];
  const free: BossMinutes = new Map([...new Set(keys)].map((key) => [key, null]));
  const taught = build({ ...input, bossDays, bossMinutes: free });
  const days = places?.(taught) ?? null;

  const dated = taught.items.map((item) => {
    const day = item.kind === "boss" ? days?.get(item.key) : undefined;

    return {
      ...item,
      beside: day?.beside ?? false,
      scheduledFor: day ? fromIsoDate(day.date) : item.scheduledFor,
    };
  });

  // A learn plan's bosses keep their days and places, after their phase's lessons.
  const placed = days
    ? putBosses({ bosses: dated.filter((item) => item.kind === "boss"), items: taught.items })
    : taught.items;

  const minutes = size(taught, placed);

  const items = placed.map((item) =>
    item.kind === "boss"
      ? {
          ...item,
          minutes: getPlannedBossMinutes({
            bossMinutes: minutes,
            goalKind: input.goal.kind,
            phase: item.phase,
          }),
        }
      : item,
  );

  const bosses = items.filter((item) => item.kind === "boss");
  const bossPhases = new Set(bosses.map((boss) => boss.phase));
  const lastBoss = bosses.flatMap((boss) => (boss.scheduledFor ? [boss.scheduledFor] : [])).at(-1);
  const endDate = taught.estimate.endDate;

  return {
    ...taught,
    bossFallback: { iterations, reason: "unsettled" },
    checkpointOverflow: addBossOverflow({
      base: listCheckpointOverflow({ bossMinutes: free, built: taught, input }),
      bosses,
    }),
    estimate: {
      endDate: lastBoss && (!endDate || lastBoss > endDate) ? lastBoss : endDate,
      remainingMinutes: Math.round(sumMinutes(items.filter((item) => item.status === "todo"))),
      totalMinutes: Math.round(sumMinutes(items)),
    },
    items,
    phases: taught.phases.map((phase, index) =>
      bossPhases.has(index)
        ? {
            ...phase,
            minutes: Math.round(sumMinutes(items.filter((item) => item.phase === index))),
          }
        : phase,
    ),
  };
}
