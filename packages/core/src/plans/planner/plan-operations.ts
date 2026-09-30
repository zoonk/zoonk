import { type AddedSkill, type PlanOperation } from "../plan-contract";
import { addDays, daysBetween, fromIsoDate, scaleWeekdayMinutes, toIsoDate } from "./plan-calendar";
import { getSkillArea } from "./plan-queue";
import { DAYS_PER_WEEK, type PlanState } from "./plan-state";
import { setTools } from "./plan-tools";

export type PlanOperationError =
  | "badMove"
  | "noStudyDays"
  | "nothingLeft"
  | "pastDate"
  | "unknownArea";

type OperationResult = { error: PlanOperationError } | { state: PlanState };

const LIGHT_WEEK_LAST_DAY = DAYS_PER_WEEK - 1;

function getAreas(state: PlanState): Set<string> {
  return new Set(state.graph.skills.map((skill) => getSkillArea({ graph: state.graph, skill })));
}

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

function withAreas({
  areas,
  state,
  update,
}: {
  areas: readonly string[];
  state: PlanState;
  update: (settings: PlanState["settings"]) => PlanState["settings"];
}): OperationResult {
  const known = getAreas(state);

  if (areas.some((area) => !known.has(area))) {
    return { error: "unknownArea" };
  }

  const settings = update(state.settings);

  if ([...known].every((area) => settings.skippedAreas.includes(area))) {
    return { error: "nothingLeft" };
  }

  return { state: { ...state, settings } };
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
 * "Move to Monday": the week's checkpoint or mock goes to a later day, at most a week later. Moving
 * the same day again replaces the earlier move, and undo brings it back.
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

  if (days < 1 || days > DAYS_PER_WEEK) {
    return { error: "badMove" };
  }

  const others = state.settings.movedEvents.filter((move) => move.from !== from);

  return {
    state: { ...state, settings: { ...state.settings, movedEvents: [...others, { from, to }] } },
  };
}

function applyOperation({
  operation,
  state,
  today,
}: {
  operation: PlanOperation;
  state: PlanState;
  today: string;
}): OperationResult {
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
    case "focusAreas":
      return withAreas({
        areas: operation.areas,
        state,
        update: (settings) => ({ ...settings, focusAreas: [...operation.areas] }),
      });
    case "skipAreas":
      return withAreas({
        areas: operation.areas,
        state,
        update: (settings) => ({
          ...settings,
          focusAreas: settings.focusAreas.filter((area) => !operation.areas.includes(area)),
          skippedAreas: [...new Set([...settings.skippedAreas, ...operation.areas])],
        }),
      });
    case "restoreAreas":
      return withAreas({
        areas: operation.areas,
        state,
        update: (settings) => ({
          ...settings,
          skippedAreas: settings.skippedAreas.filter((area) => !operation.areas.includes(area)),
        }),
      });
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
    case "addSkills":
      return { state: addSkills({ skills: operation.skills, state }) };
    case "setTools":
      return { state: setTools({ state, tools: operation.tools }) };
    default:
      return operation satisfies never;
  }
}

/**
 * Applies a change to what the learner set: time, days, light weeks, the date, areas, steering,
 * tools or missing skills. The first operation that can't apply stops the change, so none of it applies.
 */
export function applyPlanOperations({
  operations,
  state,
  today,
}: {
  operations: readonly PlanOperation[];
  state: PlanState;
  today: Date;
}): OperationResult {
  const day = toIsoDate(today);

  return operations.reduce<OperationResult>(
    (result, operation) =>
      "error" in result ? result : applyOperation({ operation, state: result.state, today: day }),
    { state },
  );
}
