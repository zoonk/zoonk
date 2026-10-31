import { toGoalPlanGraph } from "../../library/curriculum/goal-plan-graph";
import { type GoalSkillGraph } from "../../library/curriculum/save-goal-skills";
import { getFoundationSkillIds, getSkillArea } from "../../plans/planner/graph-areas";
import { type PlanGraph, type PlanGraphSkill } from "../../plans/planner/plan-state";
import { DEFAULT_START_POSITION, type OwnLevel } from "./placement-steps";

const SKILLS_PER_GROUP = 3;

/** Day-one breadth must cover every subject, including exams with more subjects than this cap. */
const MAX_SKILLS = 16;

type Pick = { area: number; group: number; rank: number; skill: PlanGraphSkill; weak: boolean };

const HALF_STEP = 0.5;

/** Self-reported knowledge must be confirmed by answers, so begin with easier bands. */
function getStartPosition({
  everySkill,
  ownLevel,
}: {
  everySkill: boolean;
  ownLevel: OwnLevel | null;
}): number {
  return everySkill || ownLevel ? 0 : DEFAULT_START_POSITION;
}

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
  const startIndex = Math.ceil(start * last - HALF_STEP);
  const ordered = [startIndex, first, rest.at(-1), ...rest.slice(0, -1)];

  return [...new Set(ordered)]
    .slice(0, count)
    .flatMap((index) => (index === undefined ? [] : (skills[index] ?? [])));
}

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

function comparePicks(a: Pick, b: Pick): number {
  return a.group - b.group || a.rank - b.rank || Number(b.weak) - Number(a.weak) || a.area - b.area;
}

/** Returns graph-ordered picks and excludes listening-only skills; everySkill covers all topics up to the cap. */
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
  focusAreas?: readonly string[];
  graph: PlanGraph;
  knownAreas?: readonly string[];
  /** The skills the goal's exam practices only with recordings (`getListeningSkillIds`). */
  listeningSkillIds?: ReadonlySet<string>;
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

/** idsByKey must match the mapping used to save the plan, including deduplicated Library skills. */
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
