import { type LessonQuestionContextInput } from "@zoonk/core/lesson-questions/contract";
import { type LessonQuestionContext } from "./lesson-question-context";

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

  if (context.kind === "item") {
    return {
      answered: context.answered,
      kind: "item",
      ...(context.blockId ? { blockId: context.blockId } : {}),
    };
  }

  return { kind: context.kind };
}
