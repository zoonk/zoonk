import { type LessonQuestionStepContext } from "./lesson-question-context";

function isGuess(step: LessonQuestionStepContext | null | undefined): boolean {
  const content = step?.content;

  return (
    step?.kind === "hook" &&
    typeof content === "object" &&
    content !== null &&
    "variant" in content &&
    content.variant === "guess"
  );
}

export function getLessonScreenVariants(context: {
  scope: { kind: string };
  step?: LessonQuestionStepContext | null;
}) {
  const onStep = context.scope.kind === "step";
  const guessScreen = onStep && isGuess(context.step);
  const teachingScreen = onStep && !guessScreen && context.step?.answerable === false;

  return { guessScreen, questionScreen: !guessScreen && !teachingScreen, teachingScreen };
}
