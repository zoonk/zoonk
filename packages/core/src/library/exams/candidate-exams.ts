import "server-only";
import { type LessonSpecParams } from "@zoonk/ai/tasks/v2/lesson-spec";
import { type ExamBlueprint, type GoalKind } from "@zoonk/db";
import { toItemExam } from "../../lookahead/placement-item-skills";

export type CandidateExam = NonNullable<LessonSpecParams["exams"]>[number];

export function toCandidateExam(blueprint: ExamBlueprint): CandidateExam {
  const { name, style } = toItemExam(blueprint);
  return { name, style };
}

export function toGoalCandidateExams({
  blueprint,
  kind,
}: {
  blueprint: ExamBlueprint | null;
  kind: GoalKind;
}): CandidateExam[] {
  return kind === "exam" && blueprint && !blueprint.ownerId ? [toCandidateExam(blueprint)] : [];
}
