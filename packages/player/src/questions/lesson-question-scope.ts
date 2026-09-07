import { type PlayerQuestionContext } from "../player-context";

export function getLessonQuestionScope(context: PlayerQuestionContext) {
  return context.kind === "lesson" ? "lesson" : context.step.id;
}

export function getLessonQuestionScopeQuery(context: PlayerQuestionContext) {
  return context.kind === "lesson"
    ? { contextKind: "lesson" as const }
    : { stepId: context.step.id };
}
