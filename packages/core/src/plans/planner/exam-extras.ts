import { type BuildPlanInput, type BuiltPlan } from "./build-plan";
import { countSkillLessons } from "./core-first";
import { getSkillArea } from "./graph-areas";
import { listLessonDays } from "./interval-study-minutes";
import { getFundedMinutes } from "./mock-funding";
import { getStudyMinutes, toIsoDate } from "./plan-calendar";
import { getSelectedCoverage } from "./plan-coverage";
import { LEARN_KINDS } from "./plan-item-rules";
import { type ExistingPlanItem, mergePlanItems } from "./plan-items";
import { PLAN_EPSILON } from "./plan-precision";
import { getCalendar } from "./plan-run-days";
import { type PlanGraph, type PlanGraphSkill } from "./plan-state";
import { buildLessonUnits } from "./plan-units";
import { getLessonCapacity, scheduleUnits } from "./schedule-units";
import { getSkillMinutes } from "./skill-minutes";
import { keepTeachingOrder, orderSkills } from "./skill-order";
import { getPendingOrder } from "./this-week-items";

export type PlanExtraInput = {
  activeItemIds: ReadonlySet<string>;
  bringBack: boolean;
  previousSkillIds: ReadonlySet<string>;
};

export function withAskedExtras(graph: PlanGraph, asked?: readonly string[]): PlanGraph {
  const extras = new Set(asked);
  const skills = graph.skills.filter((skill) => !skill.extra);
  const official = new Set(skills.map((skill) => skill.skillId));

  const selected = (graph.extraSkills ?? []).filter(
    (skill) => extras.has(skill.skillId) && !official.has(skill.skillId),
  );

  return selected.length > 0 || skills.length !== graph.skills.length
    ? { ...graph, skills: [...skills, ...selected.map((skill) => ({ ...skill, extra: true }))] }
    : graph;
}

export function withoutExamExtras(input: BuildPlanInput): BuildPlanInput {
  const skills = input.graph.skills.filter((skill) => !skill.extra);

  const ids = new Set([
    ...[
      ...input.graph.skills.filter((skill) => skill.extra),
      ...(input.graph.extraSkills ?? []),
    ].map((skill) => skill.skillId),
    ...(input.extras?.previousSkillIds ?? []),
  ]);

  const ordinary = new Set(skills.map((skill) => skill.skillId));
  const isExtra = (skillId: string) => ids.has(skillId) && !ordinary.has(skillId);

  if (ids.size === 0) {
    return input;
  }

  return {
    ...input,
    graph: { ...input.graph, skills },
    items: input.items.filter(
      (item) =>
        item.status === "done" ||
        item.status === "testedOut" ||
        input.extras?.activeItemIds.has(item.id) ||
        !isExtra(item.skillId ?? ""),
    ),
    lessons: input.lessons.filter((lesson) => lesson.skillIds.some((id) => !isExtra(id))),
  };
}

function getExtraQueue({
  built,
  requested,
  skills,
}: {
  built: BuiltPlan;
  requested: BuildPlanInput;
  skills: readonly PlanGraphSkill[];
}) {
  const ids = new Set(skills.map((skill) => skill.skillId));

  const prerequisites = keepTeachingOrder({
    prerequisites: requested.prerequisites,
    skillIds: [...ids],
  });

  const ordered = orderSkills({
    compare: (a, b) => a.index - b.index,
    prerequisites,
    skills: skills.map((skill, index) => ({
      ...skill,
      area: getSkillArea({ graph: requested.graph, skill }),
      index,
    })),
  });

  const queue = buildLessonUnits({
    lessons: requested.lessons.filter((lesson) => lesson.skillIds.some((id) => ids.has(id))),
    paceFactor: requested.paceFactor,
    prerequisites,
    preserveCourseOrder: false,
    skills: ordered,
  });

  const heldItems = built.items.map((item, position): ExistingPlanItem => ({
    ...item,
    id: item.id ?? item.key,
    position,
  }));

  return { queue, todo: getPendingOrder({ finished: heldItems, frozen: [], queue }).ordered };
}

function listSpareDays({ built, input }: { built: BuiltPlan; input: BuildPlanInput }) {
  const occupied = new Map<string, number>();

  const reserve = (day: string, minutes: number) =>
    occupied.set(day, (occupied.get(day) ?? 0) + minutes);

  built.items.forEach((item) => {
    if (item.status !== "todo" || !LEARN_KINDS.has(item.kind) || !item.scheduledFor) {
      return;
    }

    const portions = built.lessonRawMinutes.get(item.key);

    if (portions?.size) {
      portions.forEach((minutes, day) => reserve(day, minutes));
    } else {
      reserve(toIsoDate(item.scheduledFor), item.minutes);
    }
  });

  const calendar = getCalendar(input);

  const mockDates = new Set(
    built.items.flatMap((item) =>
      item.kind === "mock" && item.scheduledFor ? [toIsoDate(item.scheduledFor)] : [],
    ),
  );

  return built.planDays
    .filter((day) => day.date >= input.today && (!input.todayShown || day.date > input.today))
    .map((day) => {
      const date = toIsoDate(day.date);
      const used = occupied.get(date) ?? 0;

      const minutes = getFundedMinutes({
        base: getStudyMinutes({ calendar, date: day.date }),
        date: day.date,
        funding: built.mockFunding,
      });

      const capacity = getLessonCapacity({
        ...day,
        shape: { ...day.shape, minutes: Math.min(minutes, day.shape.minutes) },
      });

      return {
        ...day,
        shape: {
          ...day.shape,
          events: [],
          minutes: mockDates.has(date) ? 0 : Math.max(0, capacity - used) / (day.shape.share || 1),
          reserved: 0,
        },
      };
    });
}

function totalMinutes(items: readonly { minutes: number }[]) {
  return items.reduce((sum, item) => sum + item.minutes, 0);
}

function shortenSpareReviews({
  items,
  lessonDays,
}: {
  items: readonly BuiltPlan["items"][number][];
  lessonDays: ReadonlyMap<string, ReadonlyMap<string, number>>;
}) {
  const extraMinutes = new Map<string, number>();

  for (const allocations of lessonDays.values()) {
    allocations.forEach((minutes, date) =>
      extraMinutes.set(date, (extraMinutes.get(date) ?? 0) + minutes),
    );
  }

  // The day shape reserves fixed reviews before extras are placed.
  return items.flatMap((item) => {
    const date = item.scheduledFor && toIsoDate(item.scheduledFor);
    const minutes = date && extraMinutes.get(date);

    if (item.status !== "todo" || item.kind !== "review" || !minutes) {
      return [item];
    }

    const left = item.minutes - minutes;
    return left > PLAN_EPSILON ? [{ ...item, minutes: left }] : [];
  });
}

export function appendExamExtras<T extends BuiltPlan>({
  built,
  input,
  requested,
}: {
  built: T;
  input: BuildPlanInput;
  requested: BuildPlanInput;
}): T {
  const skills = requested.graph.skills.filter((skill) => skill.extra);
  const ids = new Set(skills.map((skill) => skill.skillId));

  const alreadyInPlan = requested.items.some(
    (item) =>
      item.status === "todo" &&
      ids.has(item.skillId ?? "") &&
      !requested.extras?.activeItemIds.has(item.id),
  );

  if (skills.length === 0 || input.goal.kind !== "exam" || !input.goal.targetDate) {
    return built;
  }

  const { queue, todo } = getExtraQueue({ built, requested, skills });
  const skillLessons = new Map([...built.skillLessons, ...countSkillLessons(queue)]);

  if (todo.length === 0 && queue.length > 0) {
    return { ...built, skillLessons };
  }

  const canFit =
    (requested.extras?.bringBack || requested.bringBackSetAside || alreadyInPlan) &&
    getSelectedCoverage({ built, examSubjects: null, input })?.fits;

  if (!canFit || todo.length === 0) {
    return built;
  }

  const days = listSpareDays({ built, input });
  const capacity = days.reduce((sum, day) => sum + getLessonCapacity(day), 0);

  if (totalMinutes(todo) > capacity + PLAN_EPSILON) {
    return built;
  }

  const scheduled = scheduleUnits({ days, units: todo });

  if (scheduled.dropped.length > 0 || scheduled.units.length !== todo.length) {
    return built;
  }

  const portions = listLessonDays(scheduled.units);
  const kept = shortenSpareReviews({ items: built.items, lessonDays: portions.lessonDayMinutes });

  const items = mergePlanItems({
    events: [],
    kept,
    replaced: requested.items,
    units: scheduled.units,
  });

  const delta = totalMinutes(items) - totalMinutes(built.items);
  const end = items.at(-1)?.scheduledFor;
  const priorEnd = built.estimate.endDate;
  const pendingKeys = new Set(todo.map((unit) => unit.key));

  return {
    ...built,
    estimate: {
      endDate: end && (!priorEnd || end > priorEnd) ? end : priorEnd,
      remainingMinutes: Math.round(built.estimate.remainingMinutes + delta),
      totalMinutes: Math.round(built.estimate.totalMinutes + delta),
    },
    items,
    lessonDayMinutes: new Map([...built.lessonDayMinutes, ...portions.lessonDayMinutes]),
    lessonRawMinutes: new Map([...built.lessonRawMinutes, ...portions.lessonRawMinutes]),
    phases: built.phases.map((phase, index) => ({
      ...phase,
      minutes: Math.round(totalMinutes(items.filter((item) => item.phase === index))),
    })),
    skillLessons,
    skillMinutes: [
      ...built.skillMinutes,
      ...getSkillMinutes({
        dropped: [],
        kept: queue.filter((unit) => !pendingKeys.has(unit.key)),
        pending: todo,
      }),
    ],
    teachingEnds: new Map([
      ...built.teachingEnds,
      ...scheduled.units.map((unit) => [unit.key, unit.teachingEnd ?? unit.date] as const),
    ]),
  };
}
