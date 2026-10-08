import { NOTICE_SOURCE } from "../plan-change-contract";
import { type PlanOperation } from "../plan-contract";

/**
 * What one operation changes, in the learner's terms: the study time (any day's), the date, the
 * focus (which areas get more time, and which less), one area's start or place in the plan, how
 * hard or practice-heavy lessons are, when the written tests are practiced, one language activity,
 * one light week, one moved weekly event, one added skill, one tool, and what the exam's notice
 * says.
 */
function toLevers(operation: PlanOperation): string[] {
  switch (operation.kind) {
    case "setDailyMinutes":
    case "setWeekdayMinutes":
      return ["time"];
    case "addLightWeek":
      return [`lightWeek:${operation.startDate}`];
    case "moveWeeklyEvent":
      return [`weeklyEvent:${operation.from}`];
    case "setTargetDate":
    case "setNoticeDate":
      return ["date"];
    case "focusAreas":
    case "reduceAreas":
      return ["focus"];
    case "skipAreas":
    case "restoreAreas":
      return operation.areas.map((area) => `area:${area}`);
    case "setAreaStart":
      return operation.areas.map((area) => `areaStart:${area}`);
    case "skipActivities":
    case "restoreActivities":
      return operation.activities.map((activity) => `activity:${activity}`);
    case "setPracticeBias":
      return ["practice"];
    case "setDifficultyBias":
      return ["difficulty"];
    case "setWrittenCadence":
      return ["writtenCadence"];
    case "addSkills":
      return operation.skills.map((skill) => `skill:${skill.skillId}`);
    case "setTools":
      return operation.tools.map((tool) => `tool:${tool.name}`);
    case "followNotice":
      return ["notice"];
    default:
      return operation satisfies never;
  }
}

/**
 * The things a change changes. Every change the exam's notice brings is about one thing, what the
 * notice says: a newer one says everything the waiting one still means.
 */
export function getChangeLevers({
  operations,
  source,
}: {
  operations: readonly PlanOperation[];
  source: string;
}): ReadonlySet<string> {
  return new Set([
    ...(source === NOTICE_SOURCE ? ["notice"] : []),
    ...operations.flatMap((operation) => toLevers(operation)),
  ]);
}

/**
 * Whether a newer change replaces a proposal still waiting: it changes something the proposal
 * changes too, so answering both could contradict ("an hour a day", then "two hours a day").
 * Proposals about other things stay answerable.
 */
export function replacesProposal({
  newer,
  waiting,
}: {
  newer: ReadonlySet<string>;
  waiting: ReadonlySet<string>;
}): boolean {
  return [...waiting].some((lever) => newer.has(lever));
}
