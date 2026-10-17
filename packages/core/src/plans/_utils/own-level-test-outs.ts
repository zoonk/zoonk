import { type GoalPlan } from "../../learner/_utils/goal-skill-graph";
import { type OwnLevel, START_POSITIONS } from "../../learner/placement/placement-steps";
import { type OwnLevelTestOut } from "../own-level-contract";

/** A few chapters to test out of is an offer; a long list would feel like homework. */
const MAX_TEST_OUTS = 5;

/**
 * The chapters a higher level says the learner may already know: those that start in the part
 * of the plan the level covers (a quarter for basic, half for intermediate, three quarters for
 * advanced) and still have lessons to do, in plan order.
 */
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
