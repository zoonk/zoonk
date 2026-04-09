import { usePlayerNavigation, usePlayerRuntime } from "../player-context";
import {
  getCompletionResult,
  getCurrentResult,
  getCurrentStep,
  getSelectedAnswer,
} from "../player-selectors";
import { CompletionScreenContent } from "./completion-screen";
import { FeedbackScreenContent } from "./feedback-screen";
import { StepActionButton } from "./step-action-button";
import { StepRenderer } from "./step-renderer";

/**
 * Whether the step has an action button (Begin, Check, Continue,
 * Start Investigation) — as opposed to static navigation arrows
 * handled by StepSideNav.
 *
 * When true, we render the action button inline on large screens
 * so it sits close to the content instead of fixed at the viewport bottom.
 */
function needsInlineAction(screen: ReturnType<typeof usePlayerRuntime>["screen"]) {
  return screen.kind === "step" && screen.bottomBar.kind === "primaryAction";
}

export function StageContent() {
  const { actions, screen, state } = usePlayerRuntime();
  const { lessonHref, nextActivityHref } = usePlayerNavigation();

  const completionResult = getCompletionResult(state);
  const currentResult = getCurrentResult(state);
  const currentStep = getCurrentStep(state);
  const selectedAnswer = getSelectedAnswer(state);

  if (screen.kind === "completed") {
    return (
      <CompletionScreenContent
        completionResult={completionResult}
        lessonHref={lessonHref}
        nextActivityHref={nextActivityHref}
        onRestart={actions.restart}
      />
    );
  }

  if (screen.kind === "feedbackScreen" && currentResult) {
    return (
      <div className="my-auto flex w-full flex-col items-center gap-6">
        <FeedbackScreenContent result={currentResult} step={currentStep} />
        <StepActionButton className="hidden max-w-lg lg:inline-flex" />
      </div>
    );
  }

  if (screen.kind === "step" && currentStep) {
    const showInlineAction = needsInlineAction(screen);

    const stepContent = (
      <StepRenderer
        canNavigatePrev={screen.canNavigatePrev}
        onNavigateNext={actions.navigateNext}
        onNavigatePrev={actions.navigatePrev}
        onSelectAnswer={actions.selectAnswer}
        result={state.phase === "feedback" ? currentResult : undefined}
        selectedAnswer={selectedAnswer}
        step={currentStep}
      />
    );

    if (showInlineAction) {
      return (
        <div className="my-auto flex w-full flex-col items-center gap-6">
          {stepContent}
          <StepActionButton className="hidden max-w-2xl lg:inline-flex" />
        </div>
      );
    }

    return stepContent;
  }

  return null;
}
