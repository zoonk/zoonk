import { type MemberCoverage } from "@zoonk/ai/tasks/curriculum/member-coverage";
import { insertGraphSkills, toFreeKeys } from "./add-coverage-skills";
import { placeUncoveredOf } from "./place-list-members";
import { type GoalSkillGraph } from "./save-goal-skills";

type GraphSkill = GoalSkillGraph["skills"][number];

/** A member's skill sits beside a neighbor that teaches its list, so it takes that neighbor's place. */
function toMemberSkill({
  key,
  member,
  neighbor,
}: {
  key: string;
  member: MemberCoverage["uncovered"][number];
  neighbor?: GraphSkill;
}): GraphSkill {
  return {
    area: neighbor?.area ?? "",
    course: neighbor?.course ?? "",
    description: member.description,
    estimatedLessons: neighbor?.estimatedLessons ?? 1,
    examWeight: null,
    key,
    level: neighbor?.level ?? "beginner",
    name: member.name,
    phase: neighbor?.phase ?? 1,
    prerequisites: neighbor?.prerequisites ?? [],
    topics: [],
  };
}

/** Adds a skill for each member of the goal's list the graph leaves out, beside its neighbors. */
export function addMemberSkills({
  coverage,
  graph,
}: {
  coverage: MemberCoverage;
  graph: GoalSkillGraph;
}): GoalSkillGraph {
  const placed = placeUncoveredOf({
    members: coverage.members,
    order: graph.skills.map((skill) => skill.key),
    uncovered: coverage.uncovered,
  });

  if (placed.length === 0) {
    return graph;
  }

  const keys = toFreeKeys({ count: placed.length, graph, prefix: "member" });

  const additions = placed.map((placement, index) => ({
    after: placement.after,
    skill: toMemberSkill({
      key: keys[index] ?? `member-${index + 1}`,
      member: placement.item,
      neighbor: graph.skills[placement.neighbor],
    }),
  }));

  return insertGraphSkills({ additions, graph });
}

/** Only a learn goal names a complete list; one built from the learner's own material follows it. */
export function needsMemberCheck({
  goal,
  hasMaterial,
}: {
  goal: { kind: string };
  hasMaterial: boolean;
}): boolean {
  return goal.kind === "learn" && !hasMaterial;
}
