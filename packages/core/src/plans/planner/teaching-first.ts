import { type BossMinutes, getPlannedBossMinutes } from "./boss-minutes";
import { type BuildPlanInput } from "./build-plan";
import { listCheckpointOverflow } from "./checkpoint-overflow";
import { type ExamBossDays } from "./exam-boss-days";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlannedItem } from "./plan-items";
import { type PlanPhase, type PlanSettings } from "./plan-state";

/** What placing an exam's challenges needs of a built plan, and gives back (see `settleExamBosses`). */
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

function sumMinutes(items: readonly PlannedItem[]): number {
  return items.reduce((total, item) => total + item.minutes, 0);
}

/**
 * The plan's items with each of `bosses` moved to its day: leading the day, after the work already
 * done and before the day's new lessons, or beside them, after the day's items. Bosses on one day
 * keep their order, as the challenges' projection reads them (see `projectBossPlan`).
 */
function putBosses({
  bosses,
  items,
}: {
  bosses: readonly (PlannedItem & { beside: boolean })[];
  items: readonly PlannedItem[];
}): PlannedItem[] {
  const moving = new Set(bosses.map((boss) => boss.key));
  const placed = items.filter((item) => !moving.has(item.key));

  const byDay = bosses.toSorted(
    (a, b) => (a.scheduledFor?.getTime() ?? 0) - (b.scheduledFor?.getTime() ?? 0),
  );

  for (const { beside, ...boss } of byDay) {
    const day = boss.scheduledFor?.getTime() ?? 0;

    const at = placed.findIndex((item) => {
      const date = item.scheduledFor?.getTime();

      return (
        date !== undefined &&
        (date > day || (!beside && date === day && item.status === "todo" && item.kind !== "boss"))
      );
    });

    placed.splice(at === -1 ? placed.length : at, 0, boss);
  }

  return placed;
}

/** The day's time each of `bosses` takes past it, with what the rest of the day's checkpoints take. */
function addOnTop({
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
 * A dated exam's plan with its challenges inside their days, as every goal's (R45): built once
 * with none on any day, each goes on the first study day after its own phase's teaching ends (see
 * `placeExamBosses`), and the plan is built once more with each taking its time there, the time its
 * session played as the plan last saved it (`input.bossMinutes`), leading its day, the day's lessons
 * after it; one longer than its day makes the day as long (`checkpointOverflow`). That time can end
 * a later phase's teaching past its challenge's day: that challenge then goes on the first study
 * day after it, or beside it on its last day when none is left, its time on top of that day, never
 * before what it tests (R40). Each challenge's
 * time is then what its session plays (`size`), which the next run starts from. Placed by the time
 * it took on every pass instead, its lessons ended after it, then before it, and the plan was built
 * a dozen times.
 */
export function settleExamBosses<T extends SettlingPlan>({
  build,
  input,
  place,
  size,
}: {
  build: (input: BuildPlanInput) => T;
  input: BuildPlanInput;
  /** Where an exam's bosses go on a plan's teaching (see `placeExamBosses`). */
  place: (built: T) => ExamBossDays;
  /** What each boss runs, read from the plan's items (see `sizeBosses`). */
  size: (built: T, items: readonly PlannedItem[]) => BossMinutes;
}): T & { checkpointOverflow: PlanSettings["checkpointOverflow"] } {
  const bossDays = place(build({ ...input, bossDays: new Map() }));
  const built = build({ ...input, bossDays });
  const days = place(built);

  const late = built.items.flatMap((item) => {
    const day = item.kind === "boss" ? days.get(item.key) : undefined;
    const given = bossDays.get(item.key);

    // Later, or now beside the lessons it tests on their last day (no study day left after them).
    return day && given && (day.date > given.date || (day.beside && !given.beside))
      ? [{ ...item, beside: day.beside, scheduledFor: fromIsoDate(day.date) }]
      : [];
  });

  const placed = late.length > 0 ? putBosses({ bosses: late, items: built.items }) : built.items;
  const minutes = size(built, placed);

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

  const lateKeys = new Set(late.map((boss) => boss.key));
  const bossPhases = new Set(items.flatMap((item) => (item.kind === "boss" ? [item.phase] : [])));
  const lastBoss = items.findLast((item) => item.kind === "boss")?.scheduledFor ?? null;
  const endDate = built.estimate.endDate;

  return {
    ...built,
    checkpointOverflow: addOnTop({
      base: listCheckpointOverflow({
        bossMinutes: minutes,
        built: {
          items: items.filter((item) => !lateKeys.has(item.key)),
          mockFunding: built.mockFunding,
        },
        input,
      }),
      bosses: items.filter((item) => lateKeys.has(item.key)),
    }),
    estimate: {
      endDate: lastBoss && (!endDate || lastBoss > endDate) ? lastBoss : endDate,
      remainingMinutes: Math.round(sumMinutes(items.filter((item) => item.status === "todo"))),
      totalMinutes: Math.round(sumMinutes(items)),
    },
    items,
    phases: built.phases.map((phase, index) =>
      bossPhases.has(index) && phase.kind !== "afterExam"
        ? {
            ...phase,
            minutes: Math.round(sumMinutes(items.filter((item) => item.phase === index))),
          }
        : phase,
    ),
  };
}
