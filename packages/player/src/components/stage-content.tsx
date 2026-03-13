import { type Route } from "next";
import { type CompletionResult } from "../completion-input-schema";
import {
  type DimensionInventory,
  type PlayerPhase,
  type SelectedAnswer,
  type StepResult,
} from "../player-reducer";
import { type SerializedStep } from "../prepare-activity-data";
import { ChallengeIntro } from "./challenge-intro";
import { CompletionScreenContent } from "./completion-screen";
import { FeedbackScreenContent } from "./feedback-screen";
import { StepRenderer } from "./step-renderer";

function needsFeedbackScreen(step: SerializedStep): boolean {
  return step.kind === "multipleChoice";
}

export function StageContent({
  canNavigatePrev,
  completionResult,
  currentResult,
  currentStep,
  currentStepIndex,
  dimensions,
  isCompleted,
  lessonHref,
  nextActivityHref,
  onNavigateNext,
  onNavigatePrev,
  onRestart,
  onSelectAnswer,
  onStartChallenge,
  results,
  phase,
  selectedAnswer,
}: {
  canNavigatePrev: boolean;
  completionResult: CompletionResult | null;
  currentResult: StepResult | undefined;
  currentStep: SerializedStep | undefined;
  currentStepIndex: number;
  dimensions: DimensionInventory;
  isCompleted: boolean;
  lessonHref: Route;
  nextActivityHref: Route | null;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  onRestart: () => void;
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  onStartChallenge: () => void;
  results: Record<string, StepResult>;
  phase: PlayerPhase;
  selectedAnswer: SelectedAnswer | undefined;
}) {
  if (phase === "intro") {
    return <ChallengeIntro dimensions={dimensions} onStart={onStartChallenge} />;
  }

  if (isCompleted) {
    return (
      <CompletionScreenContent
        completionResult={completionResult}
        dimensions={dimensions}
        lessonHref={lessonHref}
        nextActivityHref={nextActivityHref}
        onRestart={onRestart}
        results={results}
      />
    );
  }

  if (phase === "feedback" && currentResult && (!currentStep || needsFeedbackScreen(currentStep))) {
    return <FeedbackScreenContent dimensions={dimensions} result={currentResult} />;
  }

  if ((phase === "playing" || phase === "feedback") && currentStep) {
    return (
      <div
        className="animate-in fade-in flex min-h-0 w-full min-w-0 flex-1 flex-col items-center duration-150 ease-out motion-reduce:animate-none sm:justify-center"
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
