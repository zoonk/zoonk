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
import { PlayerContentFrame } from "./step-layouts";
import { StepRenderer } from "./step-renderer";

/**
 * Renders the desktop inline action inside the shared player frame so the
 * button stays aligned with the step content instead of growing to the full
 * stage width.
 *
 * Mobile still uses the sticky bottom bar. Large screens keep the same action
 * close to the content, but now both placements share one width source.
 */
function DesktopInlineAction() {
  return (
    <PlayerContentFrame className="hidden lg:flex">
      <StepActionButton />
    </PlayerContentFrame>
  );
}

/**
 * Primary-action screens render the shared action inline on desktop, while
 * navigable screens rely on side arrows or the mobile bottom bar.
 */
function usesDesktopInlineAction(screen: ReturnType<typeof usePlayerRuntime>["screen"]) {
  return screen.kind !== "completed" && screen.bottomBar?.kind === "primaryAction";
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
      <div className="my-auto flex w-full flex-col gap-6">
        <FeedbackScreenContent result={currentResult} step={currentStep} />
        <DesktopInlineAction />
      </div>
    );
  }

  if (screen.kind === "step" && currentStep) {
    const showInlineAction = usesDesktopInlineAction(screen);

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
        <div className="my-auto flex w-full flex-col gap-6">
          {stepContent}
          <DesktopInlineAction />
        </div>
      );
    }

    return stepContent;
  }

  return null;
}
