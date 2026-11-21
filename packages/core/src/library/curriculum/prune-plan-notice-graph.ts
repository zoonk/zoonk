import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { loadSkillSurvivors } from "../../learner/_utils/update-learner-skill";
import { type PlanGraph } from "../../plans/planner/plan-state";
import { loadSkillPrerequisites } from "../skills/skill-prerequisites";
import { findOutsideNoticeSkills } from "./prune-notice-skills";

export async function prunePlanNoticeGraph({
  db = prisma,
  graph,
  protectedIds,
  subjects,
}: {
  db?: TransactionClient;
  graph: PlanGraph;
  protectedIds?: ReadonlySet<string>;
  subjects: Parameters<typeof findOutsideNoticeSkills>[0]["subjects"];
}): Promise<{ graph: PlanGraph; dropped: string[] }> {
  const skills = [...graph.skills, ...(graph.optionSkills ?? [])].filter((skill) => !skill.extra);

  if (skills.length === 0 || subjects.length === 0) {
    return { dropped: [], graph };
  }

  const keyed = skills.map((skill) => ({ ...skill, id: skill.skillId }));

  if (findOutsideNoticeSkills({ protectedIds, skills: keyed, subjects }).length === 0) {
    return { dropped: [], graph };
  }

  const ids = skills.map((skill) => skill.skillId);
  const survivorOf = await loadSkillSurvivors(ids, db);
  const copies = Map.groupBy(ids, (id) => survivorOf(id));
  const prerequisites = await loadSkillPrerequisites([...copies.keys()], db);

  const dropped = findOutsideNoticeSkills({
    protectedIds: new Set(
      ids.filter((id) => protectedIds?.has(id) || protectedIds?.has(survivorOf(id))),
    ),
    skills: keyed.map((skill) => ({
      ...skill,
      prerequisites: prerequisites.get(survivorOf(skill.id))?.flatMap((id) => copies.get(id) ?? []),
    })),
    subjects,
  });

  if (dropped.length === 0) {
    return { dropped, graph };
  }

  const droppedIds = new Set(dropped);
  const keep = (skill: { skillId: string }) => !droppedIds.has(skill.skillId);

  const remaining = graph.skills.filter(keep);
  const remainingIds = new Set(remaining.map((skill) => skill.skillId));

  const options = graph.optionSkills
    ?.filter(keep)
    .map((skill) =>
      skill.after === null || remainingIds.has(skill.after)
        ? skill
        : {
            ...skill,
            after: remaining.findLast((item) => item.phase <= skill.phase)?.skillId ?? null,
          },
    );

  return {
    dropped,
    graph: { ...graph, ...(options && { optionSkills: options }), skills: remaining },
  };
}
