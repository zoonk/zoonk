import { type LessonQuestionStepContext } from "./lesson-question-context";

export function getLessonScreenVariants(context: {
  scope: { kind: string };
  step?: LessonQuestionStepContext | null;
}) {
  const teachingScreen = context.scope.kind === "step" && context.step?.answerable === false;

  return { questionScreen: !teachingScreen, teachingScreen };
}
