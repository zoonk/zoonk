import { type PlanOperation } from "../plan-contract";
import { getAreaEnds, getReducedEnds } from "../planner/focus-gain";
import { getFocusTargets, getTargetOf } from "../planner/focus-targets";
import { getSkillArea } from "../planner/graph-areas";
import { type AreaEnd, type AreaLessons } from "../planner/plan-effect";
import { type PlanContext } from "./plan-context";
import { type ComputedPlan } from "./replan";
import { getLessonCounters } from "./seen-effect";

function getSteeredAreas(operations: readonly PlanOperation[]): string[] | null {
  const steers = operations.every(
    (operation) => operation.kind === "focusAreas" || operation.kind === "reduceAreas",
  );

  return steers && operations.length > 0
    ? operations.flatMap((operation) => (operation.kind === "reduceAreas" ? operation.areas : []))
    : null;
}

export function getTodayExceptAreas(operations: readonly PlanOperation[]): string[] | null {
  const adds =
    operations.length > 0 && operations.every((operation) => operation.kind === "addSkills");

  return adds ? [] : getSteeredAreas(operations);
}

export function getChangePlanning(operations: readonly PlanOperation[]) {
  const movesWeeklyOnly =
    operations.length > 0 && operations.every((operation) => operation.kind === "moveWeeklyEvent");

  return {
    bringBackSetAside: !movesWeeklyOnly,
    keepPhaseDates: movesWeeklyOnly || getSteeredAreas(operations) !== null,
    mode: movesWeeklyOnly ? ("automatic" as const) : ("forced" as const),
    todayExceptAreas: getTodayExceptAreas(operations),
  };
}

function listFocusedAreas(operations: readonly PlanOperation[]): string[] {
  return operations.flatMap((operation) =>
    operation.kind === "focusAreas" ? operation.areas : [],
  );
}

type SteeredFocus = { areaOf: (skillId: string) => string | null; areas: string[] };

function readFocus({
  areas,
  computed,
}: {
  areas: readonly string[];
  computed: ComputedPlan;
}): SteeredFocus {
  const { graph, settings } = computed.state;
  const targets = getFocusTargets({ areas, graph, settings });

  return { areaOf: getTargetOf(targets), areas: targets.map((target) => target.name) };
}

export function getChangeFocus({
  computed,
  operations,
}: {
  computed: ComputedPlan;
  operations: readonly PlanOperation[];
}): SteeredFocus {
  return readFocus({ areas: listFocusedAreas(operations), computed });
}

export function getReducedAreas({
  computed,
  operations,
}: {
  computed: ComputedPlan;
  operations: readonly PlanOperation[];
}): { areaOf: (skillId: string) => string | null; areas: string[] } {
  const { graph } = computed.state;

  const areaOf = new Map(
    graph.skills.map((skill) => [skill.skillId, getSkillArea({ graph, skill })]),
  );

  return {
    areaOf: (skillId) => areaOf.get(skillId) ?? null,
    areas: operations.flatMap((operation) =>
      operation.kind === "reduceAreas" ? operation.areas : [],
    ),
  };
}

export function getSteeredEnds({
  baseline,
  computed,
  focus,
  operations,
  shown,
}: {
  baseline: ComputedPlan;
  computed: ComputedPlan;
  focus: ReturnType<typeof getChangeFocus>;
  operations: readonly PlanOperation[];
  shown: PlanContext["items"];
}): AreaEnd[] {
  const items = { after: computed.built.items, before: shown };
  const reduced = getReducedAreas({ computed, operations });
  const { lessonsAfter, lessonsBefore } = getLessonCounters({ computed, fallback: baseline });

  const withLessons = (end: AreaEnd, areaOf: SteeredFocus["areaOf"]): AreaEnd => {
    const belongs = (skillId: string) => areaOf(skillId) === end.area;
    const after = readSteered({ belongs, items: items.after, lessonsOf: lessonsAfter });
    const before = readSteered({ belongs, items: items.before, lessonsOf: lessonsBefore });
    const lessonsGained = after.lessons - before.lessons;

    return lessonsGained === 0 ? end : { ...end, lessonsGained };
  };

  return [
    ...getAreaEnds({ ...focus, ...items }).map((end) => withLessons(end, focus.areaOf)),
    ...getReducedEnds({ ...reduced, ...items }).map((end) => withLessons(end, reduced.areaOf)),
  ];
}

function readSteered<
  TItem extends { kind: string; scheduledFor: Date | null; skillId: string | null; status: string },
>({
  belongs,
  items,
  lessonsOf,
}: {
  belongs: (skillId: string) => boolean;
  items: readonly TItem[];
  lessonsOf: (item: TItem) => number;
}): { last: number; lessons: number } {
  const own = items.filter(
    (item) =>
      item.kind === "lesson" &&
      item.status === "todo" &&
      item.skillId !== null &&
      belongs(item.skillId),
  );

  return {
    last: Math.max(0, ...own.map((item) => item.scheduledFor?.getTime() ?? 0)),
    lessons: own.reduce((total, item) => total + lessonsOf(item), 0),
  };
}

const ROUNDING_LESSONS = 2;

export function getUnnamedAreaLessons({
  baseline,
  computed,
  operations,
  shown,
}: {
  baseline: ComputedPlan;
  computed: ComputedPlan;
  operations: readonly PlanOperation[];
  shown: PlanContext["items"];
}): AreaLessons[] {
  if (getSteeredAreas(operations) === null) {
    return [];
  }

  const { lessonsAfter, lessonsBefore } = getLessonCounters({ computed, fallback: baseline });
  const focus = getChangeFocus({ computed, operations });
  const { areaOf, areas: reduced } = getReducedAreas({ computed, operations });
  const named = new Set([...focus.areas, ...reduced]);
  const { graph } = computed.state;
  const areas = new Set(graph.skills.map((skill) => getSkillArea({ graph, skill })));

  return [...areas].flatMap((area) => {
    const belongs = (skillId: string) => areaOf(skillId) === area;
    const after = readSteered({ belongs, items: computed.built.items, lessonsOf: lessonsAfter });
    const before = readSteered({ belongs, items: shown, lessonsOf: lessonsBefore });
    const moved = Math.abs(after.lessons - before.lessons) > ROUNDING_LESSONS;

    return !named.has(area) && moved
      ? [{ after: after.lessons, area, before: before.lessons }]
      : [];
  });
}

export function getAskedAreas({
  focused,
  operations,
}: {
  focused: readonly string[];
  operations: readonly PlanOperation[];
}): string[] {
  const areas = listFocusedAreas(operations);
  const added = areas.filter((area) => !focused.includes(area));

  return added.length > 0 ? added : areas;
}

export function getAskedFocus({
  baseline,
  computed,
  operations,
}: {
  baseline: ComputedPlan;
  computed: ComputedPlan;
  operations: readonly PlanOperation[];
}): SteeredFocus {
  const focused = baseline.state.settings.focusAreas;
  return readFocus({ areas: getAskedAreas({ focused, operations }), computed });
}

export function contradictsSteering({
  baseline,
  computed,
  operations,
  reviewsAhead,
  shown,
}: {
  baseline: ComputedPlan;
  computed: ComputedPlan;
  operations: readonly PlanOperation[];
  reviewsAhead: boolean;
  shown: PlanContext["items"];
}): boolean {
  const steers = operations.every(
    (operation) => operation.kind === "focusAreas" || operation.kind === "reduceAreas",
  );

  if (!steers || reviewsAhead) {
    return false;
  }

  const { lessonsAfter, lessonsBefore } = getLessonCounters({ computed, fallback: baseline });
  const focus = getAskedFocus({ baseline, computed, operations });
  const reduced = getReducedAreas({ computed, operations });

  const compare = (belongs: (skillId: string) => boolean) => {
    const after = readSteered({ belongs, items: computed.built.items, lessonsOf: lessonsAfter });
    const before = readSteered({ belongs, items: shown, lessonsOf: lessonsBefore });
    return after.lessons - before.lessons || before.last - after.last;
  };

  const loses = focus.areas.some(
    (name) => compare((skillId) => focus.areaOf(skillId) === name) < 0,
  );

  const gains = reduced.areas.some(
    (area) => compare((skillId) => reduced.areaOf(skillId) === area) > 0,
  );

  return loses || gains;
}
