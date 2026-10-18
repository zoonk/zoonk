import { type StepKind } from "@zoonk/db";
import { isAnswerableStep } from "../../../lesson-player/lesson-run";

/**
 * A question must train a skill its lesson teaches: the plan derives notebook membership from
 * those links. A renamed or merged spec skill falls back to the lesson's first linked skill.
 */
export function getLessonScreenSkillId({
  lessonSkillIds,
  skillId,
}: {
  lessonSkillIds: readonly string[];
  skillId: string | null;
}): string | null {
  return skillId && lessonSkillIds.includes(skillId) ? skillId : (lessonSkillIds[0] ?? null);
}

/** A case is played through rather than practiced again (`getStepQuestion` returns null). */
export function isNotebookQuestionStep(step: { kind: StepKind }): boolean {
  return step.kind !== "challenge" && isAnswerableStep(step);
}
