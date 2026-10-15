import { type PlanOperation } from "../plan-contract";
import { getAreaEnds, getReducedEnds } from "../planner/focus-gain";
import { getFocusTargets, getTargetOf } from "../planner/focus-targets";
import { getSkillArea } from "../planner/graph-areas";
import { type AreaEnd, type AreaLessons } from "../planner/plan-effect";
import { type PlanContext } from "./plan-context";
import { type ComputedPlan } from "./replan";
import { getLessonCounters } from "./seen-effect";

/**
 * For a change of where to focus alone (more of some areas, less of others), the areas whose
 * lessons today plans again: the ones it gives less time to. Today's other lessons stay first, as
 * the learner sees them, and what the change gives more time to comes in after them (see
 * `CarryOver`). Null for any other change, which plans today again from scratch.
 */
function getSteeredAreas(operations: readonly PlanOperation[]): string[] | null {
  const steers = operations.every(
    (operation) => operation.kind === "focusAreas" || operation.kind === "reduceAreas",
  );

  return steers && operations.length > 0
    ? operations.flatMap((operation) => (operation.kind === "reduceAreas" ? operation.areas : []))
    : null;
}

/**
 * The areas whose lessons today plans again after a change (see `CarryOver`): the ones a change of
 * focus gives less time to (see `getSteeredAreas`), and none for a change that only adds topics,
 * whose lessons come after today's, from the day its card says. Planned again from scratch, Pedro's
 * added topic swapped today's lesson for the earlier phase's, and his Plan went back a phase.
 * Null for any other change, which plans today again from scratch.
 */
export function getTodayExceptAreas(operations: readonly PlanOperation[]): string[] | null {
  const adds =
    operations.length > 0 && operations.every((operation) => operation.kind === "addSkills");

  return adds ? [] : getSteeredAreas(operations);
}

/**
 * How a learner's change (but moving the phase dates) is planned: from today, with work set aside
 * for time back where it fits (on a change made only of base choices, only when that costs no topic
 * the plan holds, see `pickSetAsidePlans`), and a change of focus keeping the phase ends the
 * learner sees and today's other lessons (see `getTodayExceptAreas`). Moving the phase dates right
 * after it is planned the same way, to compare (see `askPhaseDatesAfterChange`): planned with
 * today's time open again, it fitted a phase's lessons before its challenge, so Today didn't ask
 * while the plan the change saved held two of them after it (career 2107).
 * A weekly-event move alone keeps every shown phase end and leaves work set aside out of the plan.
 */
export function getChangePlanning(operations: readonly PlanOperation[]) {
  // Moving one weekly event isn't permission to change the phase dates, including the last one,
  // or bring unrelated work back. A faster learner's replan could otherwise end before the move.
  const movesWeeklyOnly =
    operations.length > 0 && operations.every((operation) => operation.kind === "moveWeeklyEvent");

  return {
    bringBackSetAside: !movesWeeklyOnly,
    keepLastPhaseDate: movesWeeklyOnly,
    keepPhaseDates: movesWeeklyOnly || getSteeredAreas(operations) !== null,
    mode: movesWeeklyOnly ? ("automatic" as const) : ("forced" as const),
    todayExceptAreas: getTodayExceptAreas(operations),
  };
}

/** The areas a change focuses on, as the learner named them. */
function listFocusedAreas(operations: readonly PlanOperation[]): string[] {
  return operations.flatMap((operation) =>
    operation.kind === "focusAreas" ? operation.areas : [],
  );
}

/** Areas a change steers, by the name the learner sees, and the one each skill counts for. */
type SteeredFocus = { areaOf: (skillId: string) => string | null; areas: string[] };

/** The focus on these areas, or the part of one the learner named, as the computed plan reads it. */
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

/**
 * What the change's focus asks for: each area it names, or the part of one the learner named, as
 * the computed plan reads them.
 */
export function getChangeFocus({
  computed,
  operations,
}: {
  computed: ComputedPlan;
  operations: readonly PlanOperation[];
}): SteeredFocus {
  return readFocus({ areas: listFocusedAreas(operations), computed });
}

/** The areas a change gives less time to, as the computed plan reads them. */
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

/**
 * When each area a change gives more or less time to (a focus, or less of an area) has its last
 * lesson, against the plan the learner sees: the focused ones whose end moves (see
 * `getAreaEnds`), and every one it gives less time to that moves or keeps all of it (see
 * `getReducedEnds`), each with the lessons it gains or loses: short on time, Ana's "more Linguagens"
 * brought 96 of its lessons in and ended it in October instead of August, and her card said only
 * that it ended later.
 */
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

/**
 * The lessons still to do of the skills `belongs` picks, as `lessonsOf` counts each item, and the
 * day the last of them is due.
 */
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

/** An area a change doesn't name may move by rounding: at most this many lessons still to do (D5). */
const ROUNDING_LESSONS = 2;

/**
 * For a change of where to focus alone (more time for some areas, less for others): each area it
 * doesn't name whose lessons still to do move by more than rounding, with how many it has in the
 * plan the learner sees and with the change, so the card says it. The time a focus or "less"
 * moves goes to other areas too when the named ones can't take it: "more ethics, less strategy"
 * gave criminal procedure four lessons the card never named.
 */
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

/**
 * The areas a focus asks more of, which the plan holds it to: the ones it adds to the areas
 * `focused` before when it adds any, since an area focused before shares its depth with the ones
 * added beside it; else every area it focuses. Judged on every focused area, Ana's "math and
 * natural sciences", with math focused, read "Nothing changed" while natural sciences alone gained
 * 10 lessons, and Sofia's "more Ethics" from a mock, beside Civil Law, was applied for moving Civil
 * Law while Ethics gained nothing.
 */
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

/** The focus a change asks for (see `getAskedAreas`), as the computed plan reads it. */
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

/**
 * Whether a change of focus alone (more time for some areas, less for others) would do the
 * opposite in the plan the learner sees: an area they focus on left with fewer lessons than they
 * see now, or with as many done later, or one they want less of with more lessons, or as many
 * done sooner. Planned again from today, a plan can differ from the one an earlier run saved
 * (Rafaela's "more Legislative Process, less Linguistics" left the first with fewer lessons and
 * the second with more): such a change isn't offered. With a review day ahead (a test days away),
 * a focus orders that review instead, so its lessons say nothing. An area added to the focus may
 * take from one focused before (see `getAskedFocus`); the card names what that one leaves out.
 */
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

  // Below zero: the change gives the area less (fewer lessons, or as many done later).
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
