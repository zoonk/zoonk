import { type SerializedStep } from "@/data/activities/prepare-activity-data";
import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { ChallengeIntro } from "./challenge-intro";
import { CompletionScreenContent } from "./completion-screen";
import { FeedbackScreenContent } from "./feedback-screen";
import {
  type DimensionInventory,
  type PlayerPhase,
  type SelectedAnswer,
  type StepResult,
} from "./player-reducer";
import { StepRenderer } from "./step-renderer";
import { type CompletionResult } from "./submit-completion-action";

function hasInlineFeedback(step: SerializedStep): boolean {
  if (step.kind === "multipleChoice") {
    const content = parseStepContent("multipleChoice", step.content);
    return content.kind !== "challenge";
  }

  return (
    step.kind === "sortOrder" ||
    step.kind === "vocabulary" ||
    step.kind === "reading" ||
    step.kind === "listening"
  );
}

export function StageContent({
  completionResult,
  currentResult,
  currentStep,
  currentStepIndex,
  dimensions,
  isCompleted,
  isFirst,
  activityId,
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
  activityId: string;
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
        activityId={activityId}
        completionResult={completionResult}
        dimensions={dimensions}
        lessonHref={lessonHref}
        nextActivityHref={nextActivityHref}
        onRestart={onRestart}
        results={results}
      />
    );
  }

  if (phase === "feedback" && currentResult && (!currentStep || !hasInlineFeedback(currentStep))) {
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
