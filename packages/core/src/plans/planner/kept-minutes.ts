import { getPlannedBossMinutes } from "./boss-minutes";
import { type BuildPlanInput } from "./build-plan";
import { toDayMinutes } from "./interval-study-minutes";
import { getPlanCalendar, toIsoDate } from "./plan-calendar";
import {
  DAY_BEFORE_EXAM_MINUTES,
  WEEKLY_CHECKPOINT_MINUTES,
  getExamDayRules,
  getPlannedMinutes,
} from "./plan-days";
import { type ExistingPlanItem, getItemKey } from "./plan-items";
import { type ExamWindow, findExamWindow, getDayLearningShare } from "./plan-phases";
import { getPlanStart } from "./plan-run-days";
import { DEFAULT_LESSON_MINUTES, type QueueUnit } from "./plan-units";

export function getKeptMinutes({
  input,
  item,
  units,
  windows,
}: {
  input: BuildPlanInput;
  item: ExistingPlanItem;
  units: ReadonlyMap<string, QueueUnit>;
  windows: readonly ExamWindow[];
}): number {
  const unit = units.get(getItemKey(item));
  const window = item.scheduledFor ? findExamWindow({ date: item.scheduledFor, windows }) : null;

  const { practiceBias } = input.settings;

  const share = getDayLearningShare({
    date: item.scheduledFor,
    open:
      window?.kind !== "finalStretch" &&
      (input.goal.targetDate === null ||
        item.scheduledFor === null ||
        item.scheduledFor < input.goal.targetDate),
    phaseKind: window?.kind ?? "learn",
    practiceBias,
    start: getPlanStart(input),
  });

  const isFullMock = window?.kind === "finalStretch";

  const day = item.scheduledFor ? toIsoDate(item.scheduledFor) : null;
  const saved = input.settings.mockFunding.find((entry) => entry.date === day);

  const byKind: Record<ExistingPlanItem["kind"], number> = {
    boss: getPlannedBossMinutes({
      bossMinutes: input.bossMinutes,
      goalKind: input.goal.kind,
      phase: item.phase,
    }),
    chapter: 0,
    checkpoint: WEEKLY_CHECKPOINT_MINUTES,
    lesson: toDayMinutes({
      lessonMinutes: unit?.minutes ?? DEFAULT_LESSON_MINUTES * input.paceFactor,
      share,
    }),
    mock:
      saved?.minutes ??
      (isFullMock ? (input.fullMockMinutes ?? input.mockMinutes) : input.mockMinutes),
    review: item.scheduledFor
      ? getPlannedMinutes({
          calendar: getPlanCalendar({
            dailyMinutes: input.goal.dailyMinutes,
            settings: input.settings,
          }),
          date: item.scheduledFor,
          exam: getExamDayRules({ isExam: input.goal.kind === "exam", settings: input.settings }),
          targetDate: input.goal.targetDate,
        })
      : DAY_BEFORE_EXAM_MINUTES,
  };

  return byKind[item.kind];
}
