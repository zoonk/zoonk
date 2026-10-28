import { type BossMinutes, getPlannedBossMinutes } from "./boss-minutes";
import { type BuildPlanInput } from "./build-plan";
import { fromIsoDate, getPlanCalendar, toIsoDate } from "./plan-calendar";
import { getExamDayRules, getPlannedMinutes } from "./plan-days";
import { type PlannedItem } from "./plan-items";
import { type PlanSettings } from "./plan-state";

function isOverflowCheckpoint(item: PlannedItem): boolean {
  return (item.kind === "boss" || item.kind === "checkpoint") && item.scheduledFor !== null;
}

function isBeside({ boss, items }: { boss: PlannedItem; items: readonly PlannedItem[] }): boolean {
  const day = boss.scheduledFor?.getTime();
  const position = items.indexOf(boss);

  return (
    boss.kind === "boss" &&
    items.some(
      (item, index) =>
        index < position &&
        (item.kind === "lesson" || item.kind === "chapter") &&
        item.phase <= boss.phase &&
        item.scheduledFor?.getTime() === day,
    )
  );
}

export function listCheckpointOverflow({
  bossMinutes,
  built,
  input,
}: {
  bossMinutes: BossMinutes;
  built: { items: readonly PlannedItem[]; mockFunding: PlanSettings["mockFunding"] };
  input: BuildPlanInput;
}): PlanSettings["checkpointOverflow"] {
  const settings = { ...input.settings, mockFunding: built.mockFunding };
  const calendar = getPlanCalendar({ dailyMinutes: input.goal.dailyMinutes, settings });
  const exam = getExamDayRules({ isExam: input.goal.kind === "exam", settings });

  const runs = (item: PlannedItem) =>
    item.kind === "boss"
      ? getPlannedBossMinutes({ bossMinutes, goalKind: input.goal.kind, phase: item.phase })
      : item.minutes;

  const sum = (list: readonly PlannedItem[]) => list.reduce((total, item) => total + runs(item), 0);

  const days = Map.groupBy(built.items.filter(isOverflowCheckpoint), (item) =>
    toIsoDate(item.scheduledFor ?? new Date(0)),
  );

  const mocksOn = Map.groupBy(
    built.items.filter((item) => item.kind === "mock" && item.scheduledFor !== null),
    (item) => toIsoDate(item.scheduledFor ?? new Date(0)),
  );

  return [...days].flatMap(([date, checkpoints]) => {
    const regular = getPlannedMinutes({
      calendar,
      date: fromIsoDate(date),
      exam,
      targetDate: input.goal.targetDate,
    });

    const beside = checkpoints.filter((item) => isBeside({ boss: item, items: built.items }));
    const leading = checkpoints.filter((item) => !isBeside({ boss: item, items: built.items }));
    const mocks = mocksOn.get(date) ?? [];
    const minutes = sum(beside) + Math.max(0, sum(leading) + sum(mocks) - regular);

    return minutes > 0 ? [{ date, minutes }] : [];
  });
}
