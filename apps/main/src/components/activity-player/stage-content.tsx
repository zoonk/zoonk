import { type SerializedStep } from "@/data/activities/prepare-activity-data";
import { CompletionScreenContent } from "./completion-screen";
import { FeedbackScreenContent } from "./feedback-screen";
import { type SelectedAnswer, type StepResult } from "./player-reducer";
import { StepRenderer } from "./step-renderer";

export function StageContent({
  currentResult,
  currentStep,
  currentStepIndex,
  isCompleted,
  activityId,
  lessonHref,
  nextActivityHref,
  onSelectAnswer,
  results,
  phase,
  selectedAnswer,
}: {
  currentResult: StepResult | undefined;
  currentStep: SerializedStep | undefined;
  currentStepIndex: number;
  isCompleted: boolean;
  activityId: string;
  lessonHref: string;
  nextActivityHref: string | null;
  onSelectAnswer: (stepId: string, answer: SelectedAnswer) => void;
  results: Record<string, StepResult>;
  phase: string;
  selectedAnswer: SelectedAnswer | undefined;
}) {
  if (isCompleted) {
    return (
      <CompletionScreenContent
        activityId={activityId}
        lessonHref={lessonHref}
        nextActivityHref={nextActivityHref}
        results={results}
      />
    );
  }

  if (phase === "feedback" && currentResult) {
    return <FeedbackScreenContent result={currentResult} />;
  }

  if (phase === "playing" && currentStep) {
    return (
      <div
        className="animate-in fade-in duration-150 ease-out motion-reduce:animate-none"
        key={`step-${currentStepIndex}`}
      >
        <StepRenderer
          onSelectAnswer={onSelectAnswer}
          selectedAnswer={selectedAnswer}
          step={currentStep}
        />
      </div>
    );
  }

  return null;
}
