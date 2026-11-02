import { type LessonQuestionContext } from "./lesson-question-context";

export function getLessonQuestionScope(context: LessonQuestionContext) {
  if (context.kind === "item") {
    return `item:${context.itemId}`;
  }

  return context.kind === "step" || context.kind === "answer" ? context.step.id : context.kind;
}

export function getLessonQuestionScopeQuery(context: LessonQuestionContext) {
  return context.kind === "step" || context.kind === "answer"
    ? { stepId: context.step.id }
    : { contextKind: context.kind };
}
