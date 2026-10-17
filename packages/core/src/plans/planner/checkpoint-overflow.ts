import { type BossMinutes, getPlannedBossMinutes } from "./boss-minutes";
import { type BuildPlanInput } from "./build-plan";
import { fromIsoDate, getPlanCalendar, toIsoDate } from "./plan-calendar";
import { getExamDayRules, getPlannedMinutes } from "./plan-days";
import { type PlannedItem } from "./plan-items";
import { type PlanSettings } from "./plan-state";

/** A checkpoint that runs whole on its day, past the day's time: a phase's, or the week's mixed one. */
function isOverflowCheckpoint(item: PlannedItem): boolean {
  return (item.kind === "boss" || item.kind === "checkpoint") && item.scheduledFor !== null;
}

/**
 * Whether a phase's challenge sits beside the lessons it tests on their last day (see `placeBoss`):
 * one of its phase, or an earlier one, comes before it on its day. A challenge leads its day
 * otherwise, the next phase's lessons after it. The plan says it, kept or laid out again.
 */
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

/**
 * The time each day's checkpoints take past the learner's time, which the plan saves
 * (`PlanSettings.checkpointOverflow`) so the day asks for it too: a checkpoint that leads its day
 * takes what the day has and the rest past it; a phase's beside its lessons on their last day (no
 * study day left after them, see `placeBoss`) takes all of its time past them. The regular day is
 * the one Today reads (`getPlannedMinutes`).
 */
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

  return [...days].flatMap(([date, checkpoints]) => {
    const regular = getPlannedMinutes({
      calendar,
      date: fromIsoDate(date),
      exam,
      targetDate: input.goal.targetDate,
    });

    const beside = checkpoints.filter((item) => isBeside({ boss: item, items: built.items }));
    const leading = checkpoints.filter((item) => !isBeside({ boss: item, items: built.items }));
    const minutes = sum(beside) + Math.max(0, sum(leading) - regular);

    return minutes > 0 ? [{ date, minutes }] : [];
  });
}
