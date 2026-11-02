import { type GoalPlan } from "../../learner/_utils/goal-skill-graph";
import { type OwnLevel, START_POSITIONS } from "../../learner/placement/placement-steps";
import { type OwnLevelTestOut } from "../own-level-contract";

const MAX_TEST_OUTS = 5;

export function findLevelTestOuts({
  level,
  plan,
}: {
  level: OwnLevel;
  plan: GoalPlan;
}): OwnLevelTestOut[] {
  const covered = Math.ceil(plan.skills.length * START_POSITIONS[level]);

  const openSkillIds = new Set(
    plan.items.filter((item) => item.status === "todo").flatMap((item) => item.skillIds),
  );

  const chapters = plan.skills
    .slice(0, covered)
    .filter((skill) => openSkillIds.has(skill.id) && !skill.areaId.startsWith("phase:"))
    .map((skill) => ({ chapterId: skill.areaId, title: skill.areaTitle }));

  return chapters
    .filter(
      (chapter, index) =>
        chapters.findIndex((other) => other.chapterId === chapter.chapterId) === index,
    )
    .slice(0, MAX_TEST_OUTS);
}
