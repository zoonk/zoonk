import { getPlannedBossMinutes } from "./boss-minutes";
import { type BuildPlanInput } from "./build-plan";
import { getPlanCalendar, toIsoDate } from "./plan-calendar";
import {
  DAY_BEFORE_EXAM_MINUTES,
  WEEKLY_CHECKPOINT_MINUTES,
  getExamDayRules,
  getPlannedMinutes,
} from "./plan-days";
import { type ExistingPlanItem, getItemKey } from "./plan-items";
import { type ExamWindow, findExamWindow, getLearningShare } from "./plan-phases";
import { DEFAULT_LESSON_MINUTES, type QueueUnit } from "./plan-units";

/**
 * Study minutes of an item the queue no longer schedules, from its unit when there is one, at its
 * day's share of new learning. A mock in an exam's final stretch (`windows`) is the whole exam day
 * (see `createExamDays`).
 */
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

  // The share of its day's time new learning had when it was laid out: its exam phase's, as the
  // day gave it (see `createExamDays`), so a kept lesson takes the time a scheduled one would.
  const share = getLearningShare({
    phaseKind: window?.kind ?? "learn",
    practiceBias: input.settings.practiceBias,
  });

  const isFullMock = window?.kind === "finalStretch";

  // A scheduled mock is as long as the exam day the plan saved it sits (see `MockIdentity`).
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
    lesson: (unit?.minutes ?? DEFAULT_LESSON_MINUTES * input.paceFactor) / share,
    mock:
      saved?.minutes ??
      (isFullMock ? (input.fullMockMinutes ?? input.mockMinutes) : input.mockMinutes),
    // A review takes its day's time: a practice day's, the final stretch's, or the light day before
    // an exam's (see `getPlannedMinutes`), not one length for all.
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
