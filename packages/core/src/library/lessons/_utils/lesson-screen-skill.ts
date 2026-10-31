import { type StepKind } from "@zoonk/db";
import { isAnswerableStep } from "../../../lesson-player/lesson-run";

export function getLessonScreenSkillId({
  lessonSkillIds,
  skillId,
}: {
  lessonSkillIds: readonly string[];
  skillId: string | null;
}): string | null {
  return skillId && lessonSkillIds.includes(skillId) ? skillId : (lessonSkillIds[0] ?? null);
}

export function isNotebookQuestionStep(step: { kind: StepKind }): boolean {
  return step.kind !== "challenge" && isAnswerableStep(step);
}
