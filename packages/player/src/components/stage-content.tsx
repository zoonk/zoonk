import { type CompletionResult } from "../completion-input-schema";
import { type PlayerRoute } from "../player-context";
import { type PlayerPhase, type SelectedAnswer, type StepResult } from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { CompletionScreenContent } from "./completion-screen";
import { FeedbackScreenContent } from "./feedback-screen";
import { StepRenderer } from "./step-renderer";

function needsFeedbackScreen(step: SerializedStep): boolean {
  return (
    step.kind === "multipleChoice" ||
    step.kind === "translation" ||
    step.kind === "reading" ||
    step.kind === "listening"
  );
}

export function StageContent({
  canNavigatePrev,
  completionResult,
  currentResult,
  currentStep,
  currentStepIndex,
  lessonHref,
  nextActivityHref,
  onNavigateNext,
  onNavigatePrev,
  onRestart,
  onSelectAnswer,
  results,
  phase,
  selectedAnswer,
}: {
  canNavigatePrev: boolean;
  completionResult: CompletionResult | null;
  currentResult: StepResult | undefined;
  currentStep: SerializedStep | undefined;
  currentStepIndex: number;
  lessonHref: PlayerRoute;
  nextActivityHref: PlayerRoute | null;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  onRestart: () => void;
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  results: Record<string, StepResult>;
  phase: PlayerPhase;
  selectedAnswer: SelectedAnswer | undefined;
}) {
  if (phase === "completed") {
    return (
      <CompletionScreenContent
        completionResult={completionResult}
        lessonHref={lessonHref}
        nextActivityHref={nextActivityHref}
        onRestart={onRestart}
        results={results}
      />
    );
  }

  if (phase === "feedback" && currentResult && (!currentStep || needsFeedbackScreen(currentStep))) {
    return <FeedbackScreenContent result={currentResult} step={currentStep} />;
  }

  if ((phase === "playing" || phase === "feedback") && currentStep) {
    return (
      <div
        className="animate-in fade-in flex min-h-0 w-full min-w-0 flex-1 flex-col items-center duration-150 ease-out motion-reduce:animate-none"
        key={`step-${currentStepIndex}`}
      >
        <StepRenderer
          canNavigatePrev={canNavigatePrev}
          onNavigateNext={onNavigateNext}
          onNavigatePrev={onNavigatePrev}
          onSelectAnswer={onSelectAnswer}
          result={phase === "feedback" ? currentResult : undefined}
          selectedAnswer={selectedAnswer}
          step={currentStep}
        />
      </div>
    );
  }

  return null;
}
