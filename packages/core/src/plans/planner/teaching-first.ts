import { type BossMinutes, getPlannedBossMinutes } from "./boss-minutes";
import { type BuildPlanInput } from "./build-plan";
import { listCheckpointOverflow } from "./checkpoint-overflow";
import { type ExamBossDays } from "./exam-boss-days";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlannedItem } from "./plan-items";
import { type PlanPhase, type PlanSettings } from "./plan-state";

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

export function settleExamBosses<T extends SettlingPlan>({
  build,
  input,
  place,
  size,
}: {
  build: (input: BuildPlanInput) => T;
  input: BuildPlanInput;
  place: (built: T) => ExamBossDays;
  size: (built: T, items: readonly PlannedItem[]) => BossMinutes;
}): T & { checkpointOverflow: PlanSettings["checkpointOverflow"] } {
  const bossDays = place(build({ ...input, bossDays: new Map() }));
  const built = build({ ...input, bossDays });
  const days = place(built);

  const late = built.items.flatMap((item) => {
    const day = item.kind === "boss" ? days.get(item.key) : undefined;
    const given = bossDays.get(item.key);

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
