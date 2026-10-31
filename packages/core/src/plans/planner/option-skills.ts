import { getSkillArea } from "./graph-areas";
import { type PlanGraph, type PlanGraphSkill, type PlanOptionSkill } from "./plan-state";

function toGraphSkill({ after: _after, ...skill }: PlanOptionSkill): PlanGraphSkill {
  return skill;
}

function findAnchor({ graph, skill }: { graph: PlanGraph; skill: PlanOptionSkill }): string | null {
  if (skill.after === null || graph.skills.some((item) => item.skillId === skill.after)) {
    return skill.after;
  }

  return graph.skills.findLast((item) => item.phase <= skill.phase)?.skillId ?? null;
}

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

export function addSharedOptionSkills({
  areas,
  graph,
  shared,
}: {
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
