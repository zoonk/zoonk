import { toGoalPlanGraph } from "../../library/curriculum/goal-plan-graph";
import { type GoalSkillGraph } from "../../library/curriculum/save-goal-skills";
import { getFoundationSkillIds, getSkillArea } from "../../plans/planner/graph-areas";
import { type PlanGraph, type PlanGraphSkill } from "../../plans/planner/plan-state";

/**
 * Each area of each phase gets questions for up to three spread-out skills: its first skill (a
 * wrong answer there settles where it starts), its last (a right one there vouches for what it
 * builds on) and its middle, where the halving walk goes next.
 */
const SKILLS_PER_GROUP = 3;

/**
 * Questions for a big goal's first skills are enough to start: the rest come from lessons and
 * reviews. Day 1 asks at most 12 questions (`placement-budget.ts`), a right quick answer usually
 * followed by its skill's typed one, so it reaches at most 12 skills and about 6 to 8 in its four
 * minutes; a third more leaves the walk a choice, and the first week's sessions ask the picks day
 * 1 didn't reach. Picks go breadth first, so an exam with many subjects gets some in every one.
 */
const MAX_SKILLS = 16;

type Pick = { area: number; group: number; rank: number; skill: PlanGraphSkill };

/**
 * Evenly spaced picks from a group, first and last included, in the order they're most useful:
 * `perGroup` of them, or every skill of the group.
 */
function spreadPicks({
  perGroup,
  skills,
}: {
  perGroup: number;
  skills: readonly PlanGraphSkill[];
}): PlanGraphSkill[] {
  const count = Math.min(perGroup, skills.length);

  const indexes = Array.from({ length: count }, (_, index) =>
    count === 1 ? 0 : Math.round((index * (skills.length - 1)) / (count - 1)),
  );

  const [first, ...rest] = [...new Set(indexes)];
  const last = rest.at(-1);
  const middles = rest.slice(0, -1);

  return [first, last, ...middles].flatMap((index) =>
    index === undefined ? [] : (skills[index] ?? []),
  );
}

/** An area's picks: its phases in order, each phase's picks ranked by usefulness. */
function toAreaPicks({
  area,
  perGroup,
  skills,
}: {
  area: number;
  perGroup: number;
  skills: PlanGraphSkill[];
}): Pick[] {
  return [...Map.groupBy(skills, (skill) => skill.phase).values()]
    .toSorted((a, b) => (a[0]?.phase ?? 0) - (b[0]?.phase ?? 0))
    .flatMap((phaseSkills, group) =>
      spreadPicks({ perGroup, skills: phaseSkills }).map((skill, rank) => ({
        area,
        group,
        rank,
        skill,
      })),
    );
}

/**
 * The skills of a goal's skill graph that placement questions are written for ahead of time, in
 * graph order: a few per area and phase, breadth first (every area's earliest phase, both its
 * ends, before any later phase) up to a cap. The basics of a subject the learner said they know
 * well (`knownAreas`) are skipped: placement takes them as known (see `getPlacementBeliefs`), so
 * its questions go to what builds on them. Placement treats a missing question for one of these
 * as "still being written" and any other as left to lessons and reviews. A test from the learner's
 * own material (`everySkill`) is all on the test and placement asks every topic of it (see
 * `answeredOnly`), so every one of its skills gets questions, up to the same cap: Pedro's sixth
 * topic only got questions from the practice written after placement, which ended without it.
 */
export function pickPlacementItemSkillIds({
  everySkill = false,
  graph,
  knownAreas = [],
}: {
  everySkill?: boolean;
  graph: PlanGraph;
  /** The exam subjects (the graph's areas) the learner said they know well. */
  knownAreas?: readonly string[];
}): string[] {
  const order = new Map(graph.skills.map((skill, index) => [skill.skillId, index]));
  const foundations = getFoundationSkillIds(graph);
  const known = new Set(knownAreas);

  const askable = graph.skills.filter(
    (skill) => !(foundations.has(skill.skillId) && known.has(getSkillArea({ graph, skill }))),
  );

  const perGroup = everySkill ? askable.length : SKILLS_PER_GROUP;

  return [...Map.groupBy(askable, (skill) => skill.area).values()]
    .flatMap((skills, area) => toAreaPicks({ area, perGroup, skills }))
    .toSorted((a, b) => a.group - b.group || a.rank - b.rank || a.area - b.area)
    .slice(0, MAX_SKILLS)
    .map((pick) => pick.skill.skillId)
    .toSorted((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}

/**
 * The same picks from a skill graph whose skills are in the Library (`idsByKey`), while its plan is
 * being saved, so placement's questions are written alongside the plan for exactly the skills
 * placement waits on: the plan's graph is made from the same graph and ids, two graph skills the
 * Library found as one included.
 */
export function pickPlacementGraphSkillIds({
  everySkill,
  graph,
  idsByKey,
  knownAreas,
}: {
  everySkill: boolean;
  graph: GoalSkillGraph;
  idsByKey: Readonly<Record<string, string>>;
  knownAreas?: readonly string[];
}): string[] {
  return pickPlacementItemSkillIds({
    everySkill,
    graph: toGoalPlanGraph({ courseIdsByKey: {}, graph, idsByKey }),
    knownAreas,
  });
}
