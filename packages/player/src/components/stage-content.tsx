import { parseStepContent } from "@zoonk/core/steps/content-contract";
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
  if (step.kind === "multipleChoice") {
    const content = parseStepContent("multipleChoice", step.content);
    return content.kind === "challenge";
  }

  return false;
}

export function StageContent({
  completionResult,
  currentResult,
  currentStep,
  currentStepIndex,
  dimensions,
  isCompleted,
  isFirst,
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
  completionResult: CompletionResult | null;
  currentResult: StepResult | undefined;
  currentStep: SerializedStep | undefined;
  currentStepIndex: number;
  dimensions: DimensionInventory;
  isCompleted: boolean;
  isFirst: boolean;
  lessonHref: string;
  nextActivityHref: string | null;
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
        className="animate-in fade-in flex w-full flex-1 flex-col items-center duration-150 ease-out motion-reduce:animate-none sm:justify-center"
        key={`step-${currentStepIndex}`}
      >
        <StepRenderer
          isFirst={isFirst}
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
