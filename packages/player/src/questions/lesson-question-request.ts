import { type LessonQuestionContextInput } from "@zoonk/core/lesson-questions/contract";
import { type LessonQuestionContext } from "./lesson-question-context";

/**
 * Reduces the rich frozen player context to trusted references and the
 * learner's own answer. The API reconstructs course content and feedback so a
 * browser cannot inject hidden instructions or canonical answers.
 */
export function getLessonQuestionContextInput({
  context,
  lessonStepIds,
}: {
  context: LessonQuestionContext;
  lessonStepIds: string[];
}): LessonQuestionContextInput {
  if (context.kind === "lesson") {
    return { kind: "lesson", stepIds: lessonStepIds };
  }

  if (context.kind === "step") {
    return { kind: "step", stepId: context.step.id, stepNumber: context.stepIndex + 1 };
  }

  if (context.kind === "answer") {
    return {
      answer: context.selectedAnswer,
      kind: "answer",
      stepId: context.step.id,
      stepNumber: context.stepIndex + 1,
    };
  }

  return { kind: context.kind };
}
