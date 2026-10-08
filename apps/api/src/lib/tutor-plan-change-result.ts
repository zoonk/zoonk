import {
  type GoalTutorPlanChangeEffect,
  type GoalTutorPlanChangeResult,
} from "@zoonk/ai/tasks/v2/tutor/goal-tutor";
import { type proposeTutorPlanChange } from "@zoonk/core/lesson-questions/propose-plan-change";
import { type PlanOperation } from "@zoonk/core/plans/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const CADENCES = {
  biweekly: "every other week",
  finalWeeks: "only in the final weeks",
  weekly: "every week",
} as const;

function list(items: readonly string[]): string {
  return items.join(", ");
}

/** A focus names the part of an area the learner asked for, when they named one. */
function namePart({
  area,
  operation,
}: {
  area: string;
  operation: Extract<PlanOperation, { kind: "focusAreas" }>;
}): string {
  return operation.parts?.find((part) => part.area === area)?.name ?? area;
}

type AreaOperation = Extract<PlanOperation, { areas: string[] }>;

function hasAreas(operation: PlanOperation): operation is AreaOperation {
  return "areas" in operation;
}

/** A change to some of the plan's areas, naming the part of one the learner named. */
function describeAreaOperation(operation: AreaOperation): string {
  switch (operation.kind) {
    case "focusAreas":
      return `more time and depth for ${list(operation.areas.map((area) => namePart({ area, operation })))}`;
    case "reduceAreas":
      return `less time for ${list(operation.areas)}`;
    case "skipAreas":
      return `${list(operation.areas)} left out of the plan`;
    case "restoreAreas":
      return `${list(operation.areas)} back in the plan`;
    case "setAreaStart":
      return operation.start === "pastBasics"
        ? `${list(operation.areas)} start past their basics`
        : `${list(operation.areas)} start from their basics again`;
    default:
      return operation satisfies never;
  }
}

function describeWeekdays(operation: Extract<PlanOperation, { kind: "setWeekdayMinutes" }>) {
  const days = list(operation.weekdays.map((weekday) => WEEKDAYS[weekday] ?? String(weekday)));

  return operation.minutes === 0
    ? `${days}: rest day, nothing planned`
    : `${days}: ${operation.minutes} minutes`;
}

/** One operation in a few plain words, as the card says it to the learner in their language. */
function describeOperation(operation: PlanOperation): string {
  if (hasAreas(operation)) {
    return describeAreaOperation(operation);
  }

  switch (operation.kind) {
    case "setDailyMinutes":
      return `${operation.minutes} minutes a day`;
    case "setWeekdayMinutes":
      return describeWeekdays(operation);
    case "addLightWeek":
      return `a light week from ${operation.startDate}, at half the time`;
    case "moveWeeklyEvent":
      return `the week's challenge or mock moves from ${operation.from} to ${operation.to}`;
    case "setTargetDate":
      return operation.targetDate
        ? `the date moves to ${operation.targetDate}`
        : "the date is removed";
    case "skipActivities":
      return `${list(operation.activities)} left out of lessons`;
    case "restoreActivities":
      return `${list(operation.activities)} back in lessons`;
    case "setPracticeBias":
      return operation.bias === "morePractice" ? "more practice" : "more explanation";
    case "setDifficultyBias":
      return `${operation.bias} lessons`;
    case "setWrittenCadence":
      return `the written test practiced ${CADENCES[operation.cadence]}`;
    case "addSkills":
      return `adds ${list(operation.skills.map((skill) => skill.name))} first`;
    case "followNotice":
      return "the plan follows the exam notice";
    case "setNoticeDate":
      return `the exam date moves to ${operation.targetDate}`;
    case "setTools":
      return "the tools the lessons use change";
    default:
      return operation satisfies never;
  }
}

/**
 * What the change does, from its operations and where it moves the week's mocks or challenges:
 * the same facts the card says, so the answer never claims more than the change (the plan-edit
 * model's summary of the learner's words can).
 */
function describeChange(change: PlanChangeView): string {
  const moved = change.effect?.weeklyEvents;

  return [
    ...change.operations.map((operation) => describeOperation(operation)),
    moved &&
      `weekly ${moved.kind}s move from ${WEEKDAYS[moved.before]} to ${WEEKDAYS[moved.after]}`,
  ]
    .filter(Boolean)
    .join("; ");
}

/**
 * The effect as the model reads it, each area's first lesson named for which plan it's in, so
 * the answer gives the date the card gives.
 */
function toModelEffect(effect: PlanChangeView["effect"]): GoalTutorPlanChangeEffect {
  if (!effect) {
    return null;
  }

  const { areaStarts, weeklyEvents: _said, ...rest } = effect;

  return {
    ...rest,
    ...(areaStarts && {
      areaStarts: areaStarts.map((start) => ({
        area: start.area,
        firstLessonNow: start.before,
        firstLessonWithChange: start.after,
      })),
    }),
  };
}

/** What the buddy reads back after asking for a plan change; the learner sees the card instead. */
export function toPlanChangeModelResult(
  result: Awaited<ReturnType<typeof proposeTutorPlanChange>>,
): GoalTutorPlanChangeResult {
  switch (result.status) {
    case "proposed":
      return {
        cautions: result.cautions,
        changes: describeChange(result.change),
        effect: toModelEffect(result.change.effect),
        leftOut: result.leftOut,
        officialExamDate: result.change.officialDate,
        status: "proposed",
      };
    case "invalid":
      return { leftOut: result.leftOut, reason: result.error, status: "notPossible" };
    case "unchanged":
      return { leftOut: result.leftOut, status: "unchanged" };
    case "notReady":
    case "notUnderstood":
      return { status: result.status };
    case "notFound":
    case "unauthorized":
      return { reason: "unavailable", status: "notPossible" };
    default:
      return result satisfies never;
  }
}
