import { getSkillArea } from "./graph-areas";
import { type PlanGraph, type PlanGraphSkill, type PlanOptionSkill } from "./plan-state";

/** A set-aside skill as the graph studies it, without the place it keeps while it's out. */
function toGraphSkill({ after: _after, ...skill }: PlanOptionSkill): PlanGraphSkill {
  return skill;
}

/**
 * The skill a set-aside one comes back after: the one it came after, or, when that one left the
 * graph, the last skill of its phase or an earlier one (null: the graph's start).
 */
function findAnchor({ graph, skill }: { graph: PlanGraph; skill: PlanOptionSkill }): string | null {
  if (skill.after === null || graph.skills.some((item) => item.skillId === skill.after)) {
    return skill.after;
  }

  return graph.skills.findLast((item) => item.phase <= skill.phase)?.skillId ?? null;
}

/**
 * The graph with every set-aside option skill back where it was: right after the skill it came
 * after, in the order it was set aside, or at the end of its phase when that skill left the graph.
 */
export function joinOptionSkills(graph: PlanGraph): PlanGraph {
  const { optionSkills = [], ...rest } = graph;

  if (optionSkills.length === 0) {
    return rest;
  }

  const present = new Set(graph.skills.map((skill) => skill.skillId));
  const back = optionSkills.filter((skill) => !present.has(skill.skillId));
  const byAnchor = Map.groupBy(back, (skill) => findAnchor({ graph, skill }));

  const placeAfter = (anchor: string | null) =>
    (byAnchor.get(anchor) ?? []).map((skill) => toGraphSkill(skill));

  return {
    ...rest,
    skills: [
      ...placeAfter(null),
      ...graph.skills.flatMap((skill) => [skill, ...placeAfter(skill.skillId)]),
    ],
  };
}

/**
 * The graph studying none of `areas` (the options of an exam's choices the learner doesn't take):
 * their skills are set aside, each with the skill it came after, and every other set-aside skill
 * comes back, so a new pick swaps one option's skills for another's. Nothing else moves.
 */
export function setAsideOptionSkills({
  areas,
  graph,
}: {
  areas: ReadonlySet<string>;
  graph: PlanGraph;
}): PlanGraph {
  const joined = joinOptionSkills(graph);
  const isOut = (skill: PlanGraphSkill) => areas.has(getSkillArea({ graph: joined, skill }));

  const optionSkills = joined.skills.flatMap((skill, index) => {
    if (!isOut(skill)) {
      return [];
    }

    const before = joined.skills.slice(0, index).findLast((item) => !isOut(item));
    return [{ ...skill, after: before?.skillId ?? null }];
  });

  return optionSkills.length === 0
    ? joined
    : { ...joined, optionSkills, skills: joined.skills.filter((skill) => !isOut(skill)) };
}

/**
 * The graph with an option's skills it never had, from the exam's shared graph (`shared`): a plan
 * built before the exam's graph had its options gets the one the learner picks. Each comes right
 * after the skill before it in the shared graph that the plan has, in that skill's phase.
 */
export function addSharedOptionSkills({
  areas,
  graph,
  shared,
}: {
  /** The shared graph's areas of the options to add. */
  areas: ReadonlySet<string>;
  graph: PlanGraph;
  shared: PlanGraph;
}): PlanGraph {
  const joined = joinOptionSkills(graph);
  const phaseOf = new Map(joined.skills.map((skill) => [skill.skillId, skill.phase]));

  const added = shared.skills.flatMap((skill, index) => {
    if (phaseOf.has(skill.skillId) || !areas.has(getSkillArea({ graph: shared, skill }))) {
      return [];
    }

    const before = shared.skills.slice(0, index).findLast((item) => phaseOf.has(item.skillId));
    const after = before?.skillId ?? null;

    return [{ ...skill, after, phase: after === null ? 0 : (phaseOf.get(after) ?? 0) }];
  });

  return added.length === 0 ? joined : joinOptionSkills({ ...joined, optionSkills: added });
}
