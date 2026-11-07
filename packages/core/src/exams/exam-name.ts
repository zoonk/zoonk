import { type ExamBlueprint, type Goal } from "@zoonk/db";

export function getExamName({
  blueprint,
  goal,
}: {
  blueprint: Pick<ExamBlueprint, "name"> | null | undefined;
  goal: Pick<Goal, "title">;
}): string {
  return blueprint?.name ?? goal.title;
}
