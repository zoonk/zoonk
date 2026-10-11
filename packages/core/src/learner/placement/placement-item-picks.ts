import { toGoalPlanGraph } from "../../library/curriculum/goal-plan-graph";
import { type GoalSkillGraph } from "../../library/curriculum/save-goal-skills";
import { getFoundationSkillIds, getSkillArea } from "../../plans/planner/graph-areas";
import { type PlanGraph, type PlanGraphSkill } from "../../plans/planner/plan-state";
import { DEFAULT_START_POSITION, type OwnLevel } from "./placement-steps";

/**
 * Each area of each phase gets questions for up to three spread-out skills: the one placement asks
 * first (its first skill for a learner who gave a level, whose easier bands placement confirms
 * first; the middle otherwise, as the walk starts), its first skill (a wrong answer there settles
 * where it starts), its last and its middle, where the halving walk goes next.
 */
const SKILLS_PER_GROUP = 3;

/**
 * Questions for a big goal's first skills are enough to start: the rest come from lessons and
 * reviews. Day 1 asks at most 12 questions (`placement-budget.ts`), a right quick answer usually
 * followed by its skill's typed one, so it reaches at most 12 skills and about 6 to 8 in its four
 * minutes; a third more leaves the walk a choice, and the first week's sessions ask the picks day
 * 1 didn't reach. Picks go breadth first, so an exam with many subjects gets some in every one,
 * and one with more subjects than this (the OAB's 20) gets the skill placement asks first in each.
 */
const MAX_SKILLS = 16;

type Pick = { area: number; group: number; rank: number; skill: PlanGraphSkill; weak: boolean };

const HALF_STEP = 0.5;

/**
 * Where placement starts asking in a subject, from 0 (its first skill) to 1. A test from the
 * learner's own material asks its topics in the plan's order, from the first. A learner who gave
 * their level is asked the bands below it first: it's their word, which only their answers confirm
 * (the owner's decision of 10 Oct), so a subject's first skill comes first.
 */
function getStartPosition({
  everySkill,
  ownLevel,
}: {
  everySkill: boolean;
  ownLevel: OwnLevel | null;
}): number {
  return everySkill || ownLevel ? 0 : DEFAULT_START_POSITION;
}

/**
 * Picks from a group in the order they're most useful: the skill nearest where placement starts
 * asking (`start`, from 0 for the first skill to 1 for the last, the earlier one on a tie, as the
 * walk picks it), then evenly spaced ones, first and last included: `perGroup` of them, or every
 * skill of the group. Sofia studied the OAB before, so her level took each subject's first skill
 * as known: with only first skills picked, day 1 could ask two subjects of twenty.
 */
function spreadPicks({
  perGroup,
  skills,
  start,
}: {
  perGroup: number;
  skills: readonly PlanGraphSkill[];
  start: number;
}): PlanGraphSkill[] {
  const count = Math.min(perGroup, skills.length);
  const last = skills.length - 1;

  const indexes = Array.from({ length: count }, (_, index) =>
    count === 1 ? 0 : Math.round((index * last) / (count - 1)),
  );

  const [first, ...rest] = [...new Set(indexes)];
  // The nearest index, the earlier one when two are as near.
  const startIndex = Math.ceil(start * last - HALF_STEP);
  const ordered = [startIndex, first, rest.at(-1), ...rest.slice(0, -1)];

  return [...new Set(ordered)]
    .slice(0, count)
    .flatMap((index) => (index === undefined ? [] : (skills[index] ?? [])));
}

/**
 * An area's picks: its phases in order, each phase's picks ranked by usefulness, the basics the
 * learner said they know (`claimed`) first, since placement asks them before anything else.
 */
function toAreaPicks({
  area,
  claimed,
  perGroup,
  skills,
  start,
  weak,
}: {
  area: number;
  claimed: (skill: PlanGraphSkill) => boolean;
  perGroup: number;
  skills: PlanGraphSkill[];
  start: number;
  weak: boolean;
}): Pick[] {
  const pickPhase = (phaseSkills: PlanGraphSkill[]) =>
    [
      ...phaseSkills.filter((skill) => claimed(skill)),
      ...spreadPicks({ perGroup, skills: phaseSkills.filter((skill) => !claimed(skill)), start }),
    ].slice(0, perGroup);

  return [...Map.groupBy(skills, (skill) => skill.phase).values()]
    .toSorted((a, b) => (a[0]?.phase ?? 0) - (b[0]?.phase ?? 0))
    .flatMap((phaseSkills, group) =>
      pickPhase(phaseSkills).map((skill, rank) => ({ area, group, rank, skill, weak })),
    );
}

/** Breadth first: earlier phases, then each area's most useful picks first, weak areas first. */
function comparePicks(a: Pick, b: Pick): number {
  return a.group - b.group || a.rank - b.rank || Number(b.weak) - Number(a.weak) || a.area - b.area;
}

/**
 * The skills of a goal's skill graph that placement questions are written for ahead of time, in
 * graph order: a few per area and phase, breadth first (every area's earliest phase, both its
 * ends, before any later phase) up to a cap. The basics of a subject the learner said they know
 * well (`knownAreas`) come first: that's their word, which only their own answers confirm, so
 * placement asks them before anything else (see `readSkillStatuses`). The subjects they said are
 * weak (`focusAreas`) come first among picks of the same rank. Placement treats a missing question for one of these as
 * "still being written" and any other as left to lessons and reviews. A test from the learner's
 * own material (`everySkill`) is all on the test and placement asks every topic of it (see
 * `answeredOnly`), so every one of its skills gets questions, up to the same cap: Pedro's sixth
 * topic only got questions from the practice written after placement, which ended without it.
 * Skills the exam practices only with recordings (`listeningSkillIds`) get none: placement never
 * asks them (`loadPlacementPlan`), so the cap goes to the rest.
 */
export function pickPlacementItemSkillIds({
  everySkill = false,
  focusAreas = [],
  graph: goalGraph,
  knownAreas = [],
  listeningSkillIds = new Set(),
  ownLevel = null,
  prerequisites,
}: {
  everySkill?: boolean;
  /** The plan's areas the learner said are weak (`PlanSettings.focusAreas`). */
  focusAreas?: readonly string[];
  graph: PlanGraph;
  /** The exam subjects (the graph's areas) the learner said they know well. */
  knownAreas?: readonly string[];
  /** The skills the goal's exam practices only with recordings (`getListeningSkillIds`). */
  listeningSkillIds?: ReadonlySet<string>;
  /** The learner's own level, where placement starts asking in each subject. */
  ownLevel?: OwnLevel | null;
  /** Each skill's prerequisites, which say what a subject's basics are (`getFoundationSkillIds`). */
  prerequisites: ReadonlyMap<string, readonly string[]>;
}): string[] {
  const graph = {
    ...goalGraph,
    skills: goalGraph.skills.filter((skill) => !listeningSkillIds.has(skill.skillId)),
  };

  const order = new Map(graph.skills.map((skill, index) => [skill.skillId, index]));
  const foundations = getFoundationSkillIds({ graph, prerequisites });
  const known = new Set(knownAreas);
  const weak = new Set(focusAreas);

  const claimed = (skill: PlanGraphSkill) =>
    foundations.has(skill.skillId) && known.has(getSkillArea({ graph, skill }));

  const perGroup = everySkill ? graph.skills.length : SKILLS_PER_GROUP;
  const areas = [...Map.groupBy(graph.skills, (skill) => skill.area).values()];
  const start = getStartPosition({ everySkill, ownLevel });

  return areas
    .flatMap((skills, area) =>
      toAreaPicks({
        area,
        claimed,
        perGroup,
        skills,
        start,
        weak: skills.some((skill) => weak.has(getSkillArea({ graph, skill }))),
      }),
    )
    .toSorted(comparePicks)
    .slice(0, Math.max(MAX_SKILLS, areas.length))
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
  ownLevel,
}: {
  everySkill: boolean;
  graph: GoalSkillGraph;
  idsByKey: Readonly<Record<string, string>>;
  knownAreas?: readonly string[];
  ownLevel?: OwnLevel | null;
}): string[] {
  const toIds = (keys: readonly string[]) => keys.flatMap((key) => idsByKey[key] ?? []);

  return pickPlacementItemSkillIds({
    everySkill,
    graph: toGoalPlanGraph({ courseIdsByKey: {}, graph, idsByKey }),
    knownAreas,
    ownLevel,
    prerequisites: new Map(
      graph.skills.flatMap((skill) =>
        toIds([skill.key]).map((skillId) => [skillId, toIds(skill.prerequisites)] as const),
      ),
    ),
  });
}
