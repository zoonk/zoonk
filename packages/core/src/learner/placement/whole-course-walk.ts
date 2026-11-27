import { type GoalSkillNode } from "../_utils/goal-skill-graph";
import { isSkillConfirmed } from "../_utils/skill-claims";
import { type PlacementEvidence } from "./placement-beliefs";
import { buildSkillGraph, collectRelated } from "./placement-graph";

function didConfirm(answers: readonly PlacementEvidence[]) {
  return isSkillConfirmed({
    answers: answers.map((answer) => ({
      ...answer,
      isCorrect: answer.outcome === "correct",
      itemId: answer.itemId ?? null,
    })),
  });
}

export function readWholeCourseWalk({
  answers,
  skills,
}: {
  answers: readonly PlacementEvidence[];
  skills: readonly GoalSkillNode[];
}) {
  const graph = buildSkillGraph(skills);
  const bySkill = Map.groupBy(answers, (answer) => answer.skillId);

  const confirmed = new Set(
    skills.filter((skill) => didConfirm(bySkill.get(skill.id) ?? [])).map((skill) => skill.id),
  );

  const failed = new Set(
    skills
      .filter((skill) => {
        if (confirmed.has(skill.id)) {
          return false;
        }

        return bySkill.get(skill.id)?.some((answer) => answer.outcome !== "correct") ?? false;
      })
      .map((skill) => skill.id),
  );

  const pruned = new Set([
    ...failed,
    ...[...failed].flatMap((skillId) => [
      ...collectRelated({ direction: "dependents", graph, skillId }),
    ]),
  ]);

  return {
    confirmed,
    remaining: skills.filter((skill) => !confirmed.has(skill.id) && !pruned.has(skill.id)),
  };
}
