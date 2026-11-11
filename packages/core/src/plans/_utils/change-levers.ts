import { NOTICE_SOURCE } from "../plan-change-contract";
import { type PlanOperation } from "../plan-contract";
import { type StudyOperation, isStudyOperation } from "../planner/study-operations";

/** Operations that each move one lever whatever they carry. */
const SINGLE_LEVERS = {
  fitLessons: "fitLessons",
  fitPhaseDates: "phaseDates",
  followNotice: "notice",
  setAim: "aim",
} as const;

type SingleLeverOperation = Extract<PlanOperation, { kind: keyof typeof SINGLE_LEVERS }>;

function isSingleLever(operation: PlanOperation): operation is SingleLeverOperation {
  return operation.kind in SINGLE_LEVERS;
}

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

function toLevers(operation: PlanOperation): string[] {
  if (isSingleLever(operation)) {
    return [SINGLE_LEVERS[operation.kind]];
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

export function replacesProposal({
  newer,
  waiting,
}: {
  newer: ReadonlySet<string>;
  waiting: ReadonlySet<string>;
}): boolean {
  return [...waiting].some((lever) => newer.has(lever));
}
