import { type GoalKind } from "@zoonk/db";
import { type AddedSkill, type PlanOperation } from "../plan-contract";
import { type UnfundedMove } from "../plan-error-contract";
import { applyAreaOperation, isAreaOperation } from "./area-operations";
import { moveWeeklyEvent } from "./move-weekly-event";
import { addDays, fromIsoDate, scaleWeekdayMinutes, toIsoDate } from "./plan-calendar";
import { DAYS_PER_WEEK, type PlanGraph, type PlanState } from "./plan-state";
import { setTools } from "./plan-tools";
import { applyStudyOperation, isStudyOperation } from "./study-operations";

export type PlanOperationError =
  | "badMove"
  | "baseChoiceClosed"
  | "mockCollision"
  | "moveBeforeNextMonday"
  | "noStudyDays"
  | "notExam"
  | "nothingLeft"
  | "pastDate"
  | "unfundedMove"
  | "unknownArea";

/**
 * A change the plan refuses, and why. A mock moved to a day whose study days before it can't set
 * aside its time (`unfundedMove`) says that day and the mock's real length there, so the learner
 * can pick a later day; one moved to a day that already has the week's event (`mockCollision`)
 * asks for another day. The plan stays as it was.
 */
export type PlanChangeRefusal = {
  error: PlanOperationError;
  status: "invalid";
  unfundedMove?: UnfundedMove;
};

type OperationResult = { error: PlanOperationError } | { state: PlanState };

const LIGHT_WEEK_LAST_DAY = DAYS_PER_WEEK - 1;

/** The daily time a week shows as "45 min a day": its most common study-day time. */
function getTypicalMinutes(weekdayMinutes: readonly number[]): number {
  const studyDays = weekdayMinutes.filter((minutes) => minutes > 0);

  const counts = studyDays.map((minutes) => ({
    count: studyDays.filter((value) => value === minutes).length,
    minutes,
  }));

  return counts.toSorted((a, b) => b.count - a.count || b.minutes - a.minutes)[0]?.minutes ?? 0;
}

function setWeekdayMinutes({
  minutes,
  state,
  weekdays,
}: {
  minutes: number;
  state: PlanState;
  weekdays: readonly number[];
}): OperationResult {
  const current =
    state.settings.weekdayMinutes ??
    Array.from({ length: DAYS_PER_WEEK }, () => state.goal.dailyMinutes);

  const week = current.map((value, weekday) => (weekdays.includes(weekday) ? minutes : value));
  const typical = getTypicalMinutes(week);

  if (typical === 0) {
    return { error: "noStudyDays" };
  }

  const isEven = week.every((value) => value === typical);

  return {
    state: {
      ...state,
      goal: { ...state.goal, dailyMinutes: typical },
      settings: { ...state.settings, weekdayMinutes: isEven ? null : week },
    },
  };
}

function addLightWeek({
  startDate,
  state,
}: {
  startDate: string;
  state: PlanState;
}): OperationResult {
  const endDate = toIsoDate(addDays(fromIsoDate(startDate), LIGHT_WEEK_LAST_DAY));

  const others = state.settings.lightWeeks.filter(
    (week) => week.endDate < startDate || week.startDate > endDate,
  );

  const lightWeeks = [...others, { endDate, startDate }].toSorted((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );

  return { state: { ...state, settings: { ...state.settings, lightWeeks } } };
}

/** New skills go right before the skill that needs them, in its phase and area. */
function addSkills({
  skills,
  state,
}: {
  skills: readonly AddedSkill[];
  state: PlanState;
}): PlanState {
  const present = new Set(state.graph.skills.map((skill) => skill.skillId));

  const graphSkills = skills
    .filter((added) => !present.has(added.skillId))
    .reduce((list, added) => {
      const index = Math.max(
        0,
        list.findIndex((skill) => skill.skillId === added.beforeSkillId),
      );

      const anchor = list[index];

      const skill = {
        area: added.area ?? anchor?.area ?? null,
        lessons: added.lessons,
        name: added.name,
        phase: anchor?.phase ?? 0,
        skillId: added.skillId,
        weight: anchor?.weight ?? null,
      };

      return [...list.slice(0, index), skill, ...list.slice(index)];
    }, state.graph.skills);

  return { ...state, graph: { ...state.graph, skills: graphSkills } };
}

/**
 * The plan follows the graph the exam's notice gave it: its skills in its order, with the notice's
 * areas, topics and weights. A skill only this plan has (a tool's setup lesson, foundations for
 * the learner's level) keeps its place: right before the skill it came before.
 */
function followNotice({ graph, state }: { graph: PlanGraph | null; state: PlanState }): PlanState {
  if (!graph) {
    return state;
  }

  const noticeIds = new Set(graph.skills.map((skill) => skill.skillId));
  const current = state.graph.skills;

  const skills = current.reduce((list, skill, index) => {
    if (noticeIds.has(skill.skillId)) {
      return list;
    }

    const next = current.slice(index + 1).find((later) => noticeIds.has(later.skillId));
    const at = next ? list.findIndex((item) => item.skillId === next.skillId) : -1;

    return at === -1 ? [...list, skill] : [...list.slice(0, at), skill, ...list.slice(at)];
  }, graph.skills);

  return { ...state, graph: { phases: graph.phases, skills } };
}

/** The plan counts down to the notice's exam day, which stays the notice's (`noticeDate`). */
/**
 * The plan counting down to a new date (null for none). Once the date it had passed (the exam is
 * behind the learner), the new one starts a new preparation from today: its phases are measured
 * from today, not from the first plan's day.
 */
function withTargetDate({
  noticeDate,
  state,
  targetDate,
  today,
}: {
  /** The day taken from the exam's notice (see `PlanSettings.noticeDate`), when it is one. */
  noticeDate?: string;
  state: PlanState;
  targetDate: string | null;
  today: string;
}): OperationResult {
  if (targetDate !== null && targetDate <= today) {
    return { error: "pastDate" };
  }

  const passed = state.goal.targetDate !== null && state.goal.targetDate < today;

  return {
    state: {
      ...state,
      goal: { ...state.goal, targetDate },
      settings: {
        ...state.settings,
        ...(noticeDate === undefined ? {} : { noticeDate }),
        ...(passed ? { startDate: today } : {}),
      },
    },
  };
}

/** The learner's option for one of the exam's choices, in place of any earlier one for it. */
function setExamChoice({
  operation,
  state,
}: {
  operation: Extract<PlanOperation, { kind: "setExamChoice" }>;
  state: PlanState;
}): PlanState {
  const choice = { group: operation.group, subject: operation.subject };
  const current = state.settings.examChoices;
  const isPicked = current.some((item) => item.group === operation.group);

  // A changed pick keeps its place, so the picks stay in the order the learner first made them.
  const examChoices = isPicked
    ? current.map((item) => (item.group === operation.group ? choice : item))
    : [...current, choice];

  return { ...state, settings: { ...state.settings, examChoices } };
}

function applyOperation({
  goalKind,
  noticeGraph,
  operation,
  state,
  today,
}: {
  goalKind: GoalKind;
  noticeGraph: PlanGraph | null;
  operation: PlanOperation;
  state: PlanState;
  today: string;
}): OperationResult {
  if (isAreaOperation(operation)) {
    return applyAreaOperation({ operation, state });
  }

  if (isStudyOperation(operation)) {
    return applyStudyOperation({ goalKind, operation, state });
  }

  switch (operation.kind) {
    case "setDailyMinutes":
      return {
        state: {
          ...state,
          goal: { ...state.goal, dailyMinutes: operation.minutes },
          settings: {
            ...state.settings,
            weekdayMinutes: scaleWeekdayMinutes({
              dailyMinutes: operation.minutes,
              from: state.goal.dailyMinutes,
              weekdayMinutes: state.settings.weekdayMinutes,
            }),
          },
        },
      };
    case "setWeekdayMinutes":
      return setWeekdayMinutes({ minutes: operation.minutes, state, weekdays: operation.weekdays });
    case "addLightWeek":
      return operation.startDate < today
        ? { error: "pastDate" }
        : addLightWeek({ startDate: operation.startDate, state });
    case "moveWeeklyEvent":
      return moveWeeklyEvent({ from: operation.from, state, to: operation.to, today });
    case "setTargetDate":
      return withTargetDate({ state, targetDate: operation.targetDate, today });
    case "skipActivities":
      return {
        state: {
          ...state,
          settings: {
            ...state.settings,
            skippedActivities: [
              ...new Set([...state.settings.skippedActivities, ...operation.activities]),
            ],
          },
        },
      };
    case "restoreActivities":
      return {
        state: {
          ...state,
          settings: {
            ...state.settings,
            skippedActivities: state.settings.skippedActivities.filter(
              (activity) => !operation.activities.includes(activity),
            ),
          },
        },
      };
    case "addSkills":
      return { state: addSkills({ skills: operation.skills, state }) };
    case "setTools":
      return { state: setTools({ state, tools: operation.tools }) };
    case "followNotice":
      return { state: followNotice({ graph: noticeGraph, state }) };
    case "setNoticeDate":
      return withTargetDate({
        noticeDate: operation.targetDate,
        state,
        targetDate: operation.targetDate,
        today,
      });
    case "fitPhaseDates":
      // Nothing the learner set changes: applying it re-plans, which moves the phase dates.
      return { state };
    case "fitLessons":
      // Nothing the learner set changes: applying it re-plans at their time, which brings lessons in.
      return { state };
    case "setExamChoice":
      return { state: setExamChoice({ operation, state }) };
    default:
      return operation satisfies never;
  }
}

/**
 * Applies a change to what the learner set: time, days, light weeks, the date, areas, steering,
 * tools, missing skills or the exam's notice. The first operation that can't apply stops the
 * change, so none of it applies.
 */
export function applyPlanOperations({
  goalKind,
  noticeGraph = null,
  operations,
  state,
  today,
}: {
  /** The goal's kind: studying everything after the date is for exams only. */
  goalKind: GoalKind;
  /** The graph a `followNotice` operation follows, kept with its change. */
  noticeGraph?: PlanGraph | null;
  operations: readonly PlanOperation[];
  state: PlanState;
  today: Date;
}): OperationResult {
  const day = toIsoDate(today);

  return operations.reduce<OperationResult>(
    (result, operation) =>
      "error" in result
        ? result
        : applyOperation({ goalKind, noticeGraph, operation, state: result.state, today: day }),
    { state },
  );
}
