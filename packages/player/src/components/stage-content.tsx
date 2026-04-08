import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { usePlayerNavigation, usePlayerRuntime } from "../player-context";
import {
  getCanNavigatePrev,
  getCompletionResult,
  getCurrentResult,
  getCurrentStep,
  getSelectedAnswer,
} from "../player-selectors";
import { type SerializedStep } from "../prepare-activity-data";
import { CompletionScreenContent } from "./completion-screen";
import { FeedbackScreenContent } from "./feedback-screen";
import { StepRenderer } from "./step-renderer";

/**
 * Investigation action steps show feedback inline (the finding reveal
 * is brief and contextual), but the call step uses the dedicated
 * feedback screen because its debrief explanation is long-form text
 * that benefits from a focused reading experience.
 */
function isInvestigationCallStep(step: SerializedStep): boolean {
  if (step.kind !== "investigation") {
    return false;
  }

  const content = parseStepContent("investigation", step.content);
  return content.variant === "call";
}

/**
 * Determines whether a step should use the full-screen feedback view
 * after the answer is checked.
 *
 * Investigation action steps handle feedback inline (brief finding
 * reveal), but investigation call steps use the feedback screen
 * for their long-form debrief explanation.
 */
function needsFeedbackScreen(step: SerializedStep): boolean {
  return (
    step.kind === "multipleChoice" ||
    step.kind === "translation" ||
    step.kind === "reading" ||
    step.kind === "listening" ||
    step.kind === "story" ||
    isInvestigationCallStep(step)
  );
}

export function StageContent() {
  const { actions, state } = usePlayerRuntime();
  const { lessonHref, nextActivityHref } = usePlayerNavigation();

  const canNavigatePrev = getCanNavigatePrev(state);
  const completionResult = getCompletionResult(state);
  const currentResult = getCurrentResult(state);
  const currentStep = getCurrentStep(state);
  const selectedAnswer = getSelectedAnswer(state);

  if (state.phase === "completed") {
    return (
      <CompletionScreenContent
        completionResult={completionResult}
        lessonHref={lessonHref}
        nextActivityHref={nextActivityHref}
        onRestart={actions.restart}
        results={state.results}
      />
    );
  }

  if (
    state.phase === "feedback" &&
    currentResult &&
    (!currentStep || needsFeedbackScreen(currentStep))
  ) {
    return <FeedbackScreenContent result={currentResult} step={currentStep} />;
  }

  if ((state.phase === "playing" || state.phase === "feedback") && currentStep) {
    return (
      <div
        className="animate-in fade-in flex min-h-0 w-full min-w-0 flex-1 flex-col items-center duration-150 ease-out motion-reduce:animate-none"
        key={`step-${state.currentStepIndex}`}
      >
        <StepRenderer
          canNavigatePrev={canNavigatePrev}
          onNavigateNext={actions.navigateNext}
          onNavigatePrev={actions.navigatePrev}
          onSelectAnswer={actions.selectAnswer}
          result={state.phase === "feedback" ? currentResult : undefined}
          selectedAnswer={selectedAnswer}
          step={currentStep}
        />
      </div>
    );
  }

  return null;
}
