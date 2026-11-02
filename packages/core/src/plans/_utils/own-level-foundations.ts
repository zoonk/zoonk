import "server-only";
import { prisma } from "@zoonk/db";
import { type GoalPlan } from "../../learner/_utils/goal-skill-graph";
import { loadPrerequisiteGaps } from "../../memory/insights/_utils/prerequisite-gaps";
import { type PlanOperation } from "../plan-contract";
import { type PlanContext } from "./plan-context";

const MAX_ENTRY_SKILLS = 5;

export async function findFoundationOperations({
  context,
  plan,
}: {
  context: PlanContext;
  plan: GoalPlan;
}): Promise<PlanOperation[]> {
  const entryIds = new Set(
    plan.skills
      .filter((skill) => skill.prerequisiteIds.length === 0)
      .slice(0, MAX_ENTRY_SKILLS)
      .map((skill) => skill.id),
  );

  const names = await prisma.skill.findMany({
    select: { id: true, name: true },
    where: { id: { in: plan.skills.map((skill) => skill.id) } },
  });

  const goalSkills = plan.skills.map((skill) => ({
    id: skill.id,
    name: names.find((row) => row.id === skill.id)?.name ?? "",
  }));

  const gaps = await loadPrerequisiteGaps({
    goal: context.goal,
    goalSkills,
    weakSkills: goalSkills.filter((skill) => entryIds.has(skill.id)),
  });

  const skills = gaps
    .flatMap((gap) =>
      gap.skills.map((skill) => ({
        area: null,
        beforeSkillId: gap.beforeSkill.id,
        lessons: skill.lessons,
        name: skill.name,
        skillId: skill.id,
      })),
    )
    .filter(
      (skill, index, all) => all.findIndex((other) => other.skillId === skill.skillId) === index,
    );

  return skills.length > 0 ? [{ kind: "addSkills", skills }] : [];
}
