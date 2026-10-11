import { NOTICE_SOURCE } from "../plan-change-contract";
import { type PlanOperation } from "../plan-contract";
import { type StudyOperation, isStudyOperation } from "../planner/study-operations";

/**
 * The one thing each change only core proposes is about: what the exam's notice says, or the
 * plan's phase dates.
 */
const CORE_PROPOSAL_LEVERS = { fitPhaseDates: "phaseDates", followNotice: "notice" } as const;

type CoreProposal = Extract<PlanOperation, { kind: keyof typeof CORE_PROPOSAL_LEVERS }>;

function isCoreProposal(operation: PlanOperation): operation is CoreProposal {
  return operation.kind in CORE_PROPOSAL_LEVERS;
}

/** How the learner studies: practice, difficulty, written tests, after the exam, one base. */
function toStudyLevers(operation: StudyOperation): string[] {
  switch (operation.kind) {
    case "setPracticeBias":
      return ["practice"];
    case "setDifficultyBias":
      return ["difficulty"];
    case "setWrittenCadence":
      return ["writtenCadence"];
    case "setFullCourse":
      return ["fullCourse"];
    case "setBaseChoices":
      return operation.choices.map((entry) => `base:${entry.skillId}`);
    default:
      return operation satisfies never;
  }
}

/**
 * What one operation changes, in the learner's terms: the study time (any day's), the date, the
 * focus (which areas get more time, and which less), one area's start or place in the plan, how
 * hard or practice-heavy lessons are, when the written tests are practiced, studying everything
 * after the exam, one base, one language activity, one light week, one moved weekly event, one
 * added skill, one tool, one of the exam's choices, what the exam's notice says, and the plan's
 * phase dates.
 */
function toLevers(operation: PlanOperation): string[] {
  if (isCoreProposal(operation)) {
    return [CORE_PROPOSAL_LEVERS[operation.kind]];
  }

  if (isStudyOperation(operation)) {
    return toStudyLevers(operation);
  }

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
    case "addSkills":
      return operation.skills.map((skill) => `skill:${skill.skillId}`);
    case "setTools":
      return operation.tools.map((tool) => `tool:${tool.name}`);
    case "setExamChoice":
      return [`examChoice:${operation.group}`];
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
