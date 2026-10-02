import { type LessonQuestionContext } from "./lesson-question-context";

/** A step keeps its own conversation; a lesson, chapter, plan or mock has one each. */
export function getLessonQuestionScope(context: LessonQuestionContext) {
  return context.kind === "step" || context.kind === "answer" ? context.step.id : context.kind;
}

export function getLessonQuestionScopeQuery(context: LessonQuestionContext) {
  return context.kind === "step" || context.kind === "answer"
    ? { stepId: context.step.id }
    : { contextKind: context.kind };
}
