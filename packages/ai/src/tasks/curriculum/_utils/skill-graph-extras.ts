import { type SkillGraphParams } from "../skill-graph-calls";

export function writesExamExtras({
  goalKind,
  hasMaterial,
  lessonBudget,
}: Pick<SkillGraphParams, "goalKind" | "hasMaterial" | "lessonBudget">): boolean {
  return goalKind === "exam" && !hasMaterial && !lessonBudget;
}
