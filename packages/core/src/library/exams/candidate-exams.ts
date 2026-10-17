import "server-only";
import { type LessonSpecParams } from "@zoonk/ai/tasks/v2/lesson-spec";
import { type ExamBlueprint, type GoalKind } from "@zoonk/db";
import { toItemExam } from "../../lookahead/placement-item-skills";

/** An exam shared content is written for: its name and how its questions look and score. */
export type CandidateExam = NonNullable<LessonSpecParams["exams"]>[number];

/** How an exam's candidates are told about to the models that outline and write shared content. */
export function toCandidateExam(blueprint: ExamBlueprint): CandidateExam {
  const { name, style } = toItemExam(blueprint);
  return { name, style };
}

/**
 * The exam a goal prepares for, as shared outlines read it so they're written at its depth and in
 * its style for its candidates, without naming it: an exam goal's public notice. None for other
 * goals, an exam whose notice isn't read yet, or a private one (its course follows the learner's
 * material instead).
 */
export function toGoalCandidateExams({
  blueprint,
  kind,
}: {
  blueprint: ExamBlueprint | null;
  kind: GoalKind;
}): CandidateExam[] {
  return kind === "exam" && blueprint && !blueprint.ownerId ? [toCandidateExam(blueprint)] : [];
}
