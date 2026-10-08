import { type AddedSkill, type PlanOperation } from "../plan-contract";
import { applyAreaOperation, isAreaOperation } from "./area-operations";
import { addDays, daysBetween, fromIsoDate, scaleWeekdayMinutes, toIsoDate } from "./plan-calendar";
import { DAYS_PER_WEEK, type PlanGraph, type PlanState } from "./plan-state";
import { setTools } from "./plan-tools";

export type PlanOperationError =
  | "badMove"
  | "noStudyDays"
  | "nothingLeft"
  | "pastDate"
  | "unknownArea";

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
function setNoticeDate({
  state,
  targetDate,
  today,
}: {
  state: PlanState;
  targetDate: string;
  today: string;
}): OperationResult {
  if (targetDate <= today) {
    return { error: "pastDate" };
  }

  return {
    state: {
      ...state,
      goal: { ...state.goal, targetDate },
      settings: { ...state.settings, noticeDate: targetDate },
    },
  };
}

/**
 * "Move to Monday": the week's checkpoint or mock goes to a later day, at most a week later and
 * before the goal's date (a mock moved onto or past the test day no longer prepares for it).
 * Moving the same day again replaces the earlier move, and undo brings it back.
 */
function moveWeeklyEvent({
  from,
  state,
  to,
  today,
}: {
  from: string;
  state: PlanState;
  to: string;
  today: string;
}): OperationResult {
  if (from < today) {
    return { error: "pastDate" };
  }

  const days = daysBetween(fromIsoDate(from), fromIsoDate(to));
  const { targetDate } = state.goal;

  if (days < 1 || days > DAYS_PER_WEEK || (targetDate && to >= targetDate)) {
    return { error: "badMove" };
  }

  const others = state.settings.movedEvents.filter((move) => move.from !== from);

  return {
    state: { ...state, settings: { ...state.settings, movedEvents: [...others, { from, to }] } },
  };
}

function applyOperation({
  noticeGraph,
  operation,
  state,
  today,
}: {
  noticeGraph: PlanGraph | null;
  operation: PlanOperation;
  state: PlanState;
  today: string;
}): OperationResult {
  if (isAreaOperation(operation)) {
    return applyAreaOperation({ operation, state });
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
      return operation.targetDate !== null && operation.targetDate <= today
        ? { error: "pastDate" }
        : { state: { ...state, goal: { ...state.goal, targetDate: operation.targetDate } } };
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
    case "setPracticeBias":
      return { state: { ...state, settings: { ...state.settings, practiceBias: operation.bias } } };
    case "setDifficultyBias":
      return {
        state: { ...state, settings: { ...state.settings, difficultyBias: operation.bias } },
      };
    case "setWrittenCadence":
      return {
        state: { ...state, settings: { ...state.settings, writtenCadence: operation.cadence } },
      };
    case "addSkills":
      return { state: addSkills({ skills: operation.skills, state }) };
    case "setTools":
      return { state: setTools({ state, tools: operation.tools }) };
    case "followNotice":
      return { state: followNotice({ graph: noticeGraph, state }) };
    case "setNoticeDate":
      return setNoticeDate({ state, targetDate: operation.targetDate, today });
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
  noticeGraph = null,
  operations,
  state,
  today,
}: {
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
        : applyOperation({ noticeGraph, operation, state: result.state, today: day }),
    { state },
  );
}
