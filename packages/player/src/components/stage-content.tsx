import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import {
  type PlayerRuntimeContextValue,
  usePlayerNavigation,
  usePlayerRuntime,
  usePlayerViewer,
} from "../player-context";
import {
  getActiveCompletionMilestone,
  getCompletionResult,
  getCurrentResult,
  getCurrentStep,
  getSelectedAnswer,
} from "../player-selectors";
import { describePlayerStep } from "../player-step";
import { CompletionProgressMilestoneScreen } from "./completion-progress-milestone-screen";
import { CompletionScreenContent } from "./completion-screen";
import { FeedbackScreenContent } from "./feedback-screen";
import { StepActionButton } from "./step-action-button";
import { PlayerContentFrame } from "./step-layouts";
import { StepRenderer } from "./step-renderer";
import { UnauthenticatedStartWarningScreen } from "./unauthenticated-progress-prompt";

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
function hasDesktopInlineAction(screen: PlayerRuntimeContextValue["screen"]) {
  return screen.kind !== "completed" && screen.bottomBar?.kind === "primaryAction";
}

/**
 * Some visual steps own their CTA placement inside the content itself.
 *
 * Image-led choice steps keep the action inside the right-hand column, while
 * full-screen hero steps keep their action inside the bottom card. The global
 * desktop action slot still serves every other primary-action screen.
 */
function hasEmbeddedDesktopAction({
  screen,
  step,
}: {
  screen: PlayerRuntimeContextValue["screen"];
  step?: SerializedStep;
}) {
  if (screen.stageIsFullBleed) {
    return true;
  }

  const descriptor = describePlayerStep(step);

  if (descriptor?.kind === "multipleChoice") {
    return Boolean(descriptor.content.image);
  }

  return false;
}

export function StageContent() {
  const { actions, screen, state } = usePlayerRuntime();

  const { chapterHref, energyHref, levelHref, loginHref, nextLessonHref, scoreHref } =
    usePlayerNavigation();

  const { isAuthenticated } = usePlayerViewer();

  const activeCompletionMilestone = getActiveCompletionMilestone(state);
  const completionResult = getCompletionResult(state);
  const currentResult = getCurrentResult(state);
  const currentStep = getCurrentStep(state);
  const selectedAnswer = getSelectedAnswer(state);

  if (screen.kind === "startWarning") {
    return (
      <UnauthenticatedStartWarningScreen
        loginHref={loginHref ?? "/login"}
        onContinue={actions.start}
      />
    );
  }

  if (screen.kind === "completed") {
    if (isAuthenticated && activeCompletionMilestone) {
      return (
        <CompletionProgressMilestoneScreen
          energyHref={energyHref}
          levelHref={levelHref}
          milestone={activeCompletionMilestone}
          onContinue={actions.continue}
          scoreHref={scoreHref}
        />
      );
    }

    return (
      <CompletionScreenContent
        completionResult={completionResult}
        chapterHref={chapterHref}
        nextLessonHref={nextLessonHref}
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
    const showInlineAction =
      hasDesktopInlineAction(screen) && !hasEmbeddedDesktopAction({ screen, step: currentStep });

    const stepContent = (
      <StepRenderer
        canNavigatePrev={screen.canNavigatePrev}
        onNavigateNext={actions.navigateNext}
        onNavigatePrev={actions.navigatePrev}
        onSelectAnswer={actions.selectAnswer}
        promptAudioUrl={screen.bottomBar?.audioUrl}
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
