import { MAX_DAILY_MINUTES } from "../daily-minutes";
import { type BuildPlanInput, type BuiltPlan } from "./build-plan";
import { type StudyScheduleAt, withDailyMinutes } from "./daily-time-plans";
import { addDays, daysBetween } from "./plan-calendar";
import { PLAN_EPSILON } from "./plan-precision";
import { createDays, getPlanStart } from "./plan-run-days";
import { DEFAULT_LESSON_MINUTES } from "./plan-units";
import { type ExamSubjectShare, getWholeShortfall } from "./selected-coverage";
import { getCoverageDeadline } from "./selected-plan-summary";
import { type SkillRequirement, listSettled, readLeastRequirement } from "./selected-requirement";

/** Room the floor leaves for lesson time it can't see, so it never rises above a time that fits. */
const UNSEEN_SHARE = 0.05;

/** As much of the days' time before the date as lessons may take: events and mock funding only take from it. */
function getLessonRoom({
  input,
  minutes,
  studyScheduleAt,
  targetDate,
}: {
  input: BuildPlanInput;
  minutes: number;
  studyScheduleAt?: StudyScheduleAt;
  targetDate: Date;
}): number {
  const at = withDailyMinutes(input, minutes, studyScheduleAt);
  const { describeDay } = createDays({ input: at, planStart: getPlanStart(at) });
  const days = Math.max(0, daysBetween(input.today, targetDate));

  return Array.from({ length: days }, (_, offset) =>
    describeDay(addDays(input.today, offset)),
  ).reduce((room, day) => room + Math.max(0, day.minutes) * day.share, 0);
}

/** A lesson laid out past the last day's room lands on its own day, so one can count beyond the room. */
function getLongestLesson({
  input,
  requirement,
}: {
  input: BuildPlanInput;
  requirement: ReadonlyMap<string, SkillRequirement>;
}): number {
  const standIn = [...requirement.values()].some((skill) => skill.standIn > 0)
    ? DEFAULT_LESSON_MINUTES
    : 0;

  const lessons = [...input.lessons, ...(input.quickLessons?.values() ?? [])];

  return (
    lessons.reduce((longest, lesson) => Math.max(longest, lesson.minutes), standIn) *
    input.paceFactor
  );
}

/**
 * The fewest daily minutes that could still cover the whole goal by its date: what `built` (the plan
 * at the fewest minutes searched, whose kept and frozen work every other time keeps too) leaves
 * uncovered has to fit in the lesson room the extra time adds. Above `MAX_DAILY_MINUTES` when not
 * even a whole day can.
 */
export function getFittingFloor({
  built,
  examSubjects,
  input,
  studyScheduleAt,
}: {
  built: BuiltPlan;
  examSubjects: readonly ExamSubjectShare[] | null;
  input: BuildPlanInput;
  studyScheduleAt?: StudyScheduleAt;
}): number {
  const deadline = getCoverageDeadline({ built, input });
  const { targetDate } = input.goal;

  if (!deadline || !targetDate) {
    return 0;
  }

  const requirement = readLeastRequirement({ built, input });

  const shortfall = getWholeShortfall({
    built,
    deadline,
    examSubjects,
    input,
    requirement,
    settled: listSettled(input),
  });

  const needed =
    shortfall * (1 - UNSEEN_SHARE) -
    getLongestLesson({ input, requirement }) -
    requirement.size * PLAN_EPSILON;

  if (needed <= 0) {
    return 0;
  }

  const holds = (minutes: number) =>
    getLessonRoom({ input, minutes, studyScheduleAt, targetDate }) >= needed;

  if (!holds(MAX_DAILY_MINUTES)) {
    return MAX_DAILY_MINUTES + 1;
  }

  const search = (low: number, high: number): number => {
    if (low >= high) {
      return low;
    }

    const middle = Math.floor((low + high) / 2);
    return holds(middle) ? search(low, middle) : search(middle + 1, high);
  };

  return search(1, MAX_DAILY_MINUTES);
}
