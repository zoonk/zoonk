import { type BossMinutes, getPlannedBossMinutes } from "./boss-minutes";
import { type BuildPlanInput } from "./build-plan";
import { listCheckpointOverflow } from "./checkpoint-overflow";
import { type ExamBossDays } from "./exam-boss-days";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlannedItem } from "./plan-items";
import { type PlanPhase, type PlanSettings } from "./plan-state";

/** What teaching first needs of a built plan, and gives back (see `settleTeachingFirst`). */
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

/** The day's time each boss takes past it, with what the rest of the day's checkpoints take. */
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
 * A plan with its bosses placed teaching first (see `settlePlannedBosses`): built once with every
 * boss (`bossKeys`) taking none of its day's time, its lessons, mocks' funding, past credits and
 * phase windows stay as that build has them; each boss then goes on the first study day after the
 * lessons it tests end, or beside them on their last day (see `placeExamBosses`), at the time its
 * session plays, all of it asked of its day on top (`checkpointOverflow`), as Today and the Plan
 * show it.
 */
export function settleTeachingFirst<T extends SettlingPlan>({
  bossDays,
  bossKeys,
  build,
  input,
  places,
  size,
}: {
  bossDays: ExamBossDays | undefined;
  bossKeys: readonly string[];
  build: (input: BuildPlanInput) => T;
  input: BuildPlanInput;
  /** Where an exam's bosses go on a plan's fixed teaching (see `placeExamBosses`). */
  places: ((built: T) => ExamBossDays) | null;
  /** What each boss runs, read from the plan's items (see `sizeBosses`). */
  size: (built: T, items: readonly PlannedItem[]) => BossMinutes;
}): T & { checkpointOverflow: PlanSettings["checkpointOverflow"] } {
  const free: BossMinutes = new Map(bossKeys.map((key) => [key, null]));
  const taught = build({ ...input, bossDays, bossMinutes: free });
  const days = places?.(taught) ?? null;

  // The build puts each boss on the day it's given, kept and finished ones where the plan keeps
  // them; one whose teaching ends elsewhere on this layout moves. Without days (an exam's without
  // a date, or another goal's), bosses keep the days and places their build gives them.
  const moved = taught.items.flatMap((item) => {
    const day = item.kind === "boss" ? days?.get(item.key) : undefined;
    const given = bossDays?.get(item.key);

    return day && (day.date !== given?.date || day.beside !== given.beside)
      ? [{ ...item, beside: day.beside, scheduledFor: fromIsoDate(day.date) }]
      : [];
  });

  const placed =
    moved.length > 0 ? putBosses({ bosses: moved, items: taught.items }) : taught.items;

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
  const exam = input.goal.targetDate;

  // The time the work after the exam takes counts its bosses at what they run, not at what the
  // build laid them out with.
  const afterExam = (list: readonly PlannedItem[]) =>
    sumMinutes(
      list.filter(
        (item) => item.kind === "boss" && exam && item.scheduledFor && item.scheduledFor > exam,
      ),
    );

  const afterExamGain = afterExam(items) - afterExam(taught.items);
  const lastBoss = bosses.flatMap((boss) => (boss.scheduledFor ? [boss.scheduledFor] : [])).at(-1);
  const endDate = taught.estimate.endDate;

  return {
    ...taught,
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
    phases: taught.phases.map((phase, index) => {
      if (phase.kind === "afterExam") {
        return { ...phase, minutes: Math.round(phase.minutes + afterExamGain) };
      }

      return bossPhases.has(index)
        ? {
            ...phase,
            minutes: Math.round(sumMinutes(items.filter((item) => item.phase === index))),
          }
        : phase;
    }),
  };
}
