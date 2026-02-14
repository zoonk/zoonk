import { type SerializedStep } from "@/data/activities/prepare-activity-data";
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

export function StageContent({
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
  onSelectAnswer: (stepId: string, answer: SelectedAnswer) => void;
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
        dimensions={dimensions}
        lessonHref={lessonHref}
        nextActivityHref={nextActivityHref}
        onRestart={onRestart}
        results={results}
      />
    );
  }

  if (phase === "feedback" && currentResult) {
    return <FeedbackScreenContent dimensions={dimensions} result={currentResult} />;
  }

  if (phase === "playing" && currentStep) {
    return (
      <div
        className="animate-in fade-in flex w-full flex-col items-center duration-150 ease-out motion-reduce:animate-none"
        key={`step-${currentStepIndex}`}
      >
        <StepRenderer
          isFirst={isFirst}
          onNavigateNext={onNavigateNext}
          onNavigatePrev={onNavigatePrev}
          onSelectAnswer={onSelectAnswer}
          selectedAnswer={selectedAnswer}
          step={currentStep}
        />
      </div>
    );
  }

  return null;
}
