"use client";

import { ContentFeedback } from "@/components/feedback/content-feedback";
import { computeScore } from "@zoonk/core/player/compute-score";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheck } from "lucide-react";
import { useExtracted } from "next-intl";
import { ChallengeFailureContent, ChallengeSuccessContent } from "./challenge-completion";
import { AuthBranch } from "./completion-auth-branch";
import { hasNegativeDimension } from "./has-negative-dimension";
import { type DimensionInventory, type StepResult } from "./player-reducer";
import { type CompletionResult } from "./submit-completion-action";

function CompletionScreen({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "animate-in fade-in mx-auto flex w-full max-w-lg flex-col items-center gap-6 duration-200 ease-out motion-reduce:animate-none",
        className,
      )}
      data-slot="completion-screen"
      role="status"
      {...props}
    />
  );
}

function CompletionScore({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col items-center gap-1", className)}
      data-slot="completion-score"
      {...props}
    />
  );
}

function CompletionSignal() {
  const t = useExtracted();

  return (
    <div className="flex flex-col items-center gap-2">
      <CircleCheck className="text-foreground size-12" />
      <p className="text-lg font-medium">{t("Completed")}</p>
    </div>
  );
}

function getCompletionScore(results: Record<string, StepResult>) {
  const resultList = Object.values(results);

  if (resultList.length === 0) {
    return null;
  }

  const score = computeScore({
    results: resultList.map((stepResult) => ({ isCorrect: stepResult.result.isCorrect })),
  });

  return { correctCount: score.correctCount, totalCount: resultList.length };
}

export function CompletionScreenContent({
  activityId,
  completionResult,
  dimensions,
  lessonHref,
  nextActivityHref,
  onRestart,
  results,
}: {
  activityId: string;
  completionResult: CompletionResult | null;
  dimensions: DimensionInventory;
  lessonHref: string;
  nextActivityHref: string | null;
  onRestart: () => void;
  results: Record<string, StepResult>;
}) {
  const t = useExtracted();
  const isChallenge = Object.keys(dimensions).length > 0;

  if (isChallenge && hasNegativeDimension(dimensions)) {
    return (
      <ChallengeFailureContent
        activityId={activityId}
        completionResult={completionResult}
        dimensions={dimensions}
        lessonHref={lessonHref}
        onRestart={onRestart}
      />
    );
  }

  if (isChallenge) {
    return (
      <ChallengeSuccessContent
        activityId={activityId}
        completionResult={completionResult}
        dimensions={dimensions}
      >
        <AuthBranch
          completionResult={completionResult}
          lessonHref={lessonHref}
          nextActivityHref={nextActivityHref}
          onRestart={onRestart}
          showRewards={false}
        />
      </ChallengeSuccessContent>
    );
  }

  const score = getCompletionScore(results);

  return (
    <CompletionScreen>
      {score ? (
        <CompletionScore>
          <p className="text-5xl font-bold tracking-tight tabular-nums">
            {score.correctCount}/{score.totalCount}
          </p>
          <p className="text-muted-foreground text-sm">{t("correct")}</p>
        </CompletionScore>
      ) : (
        <CompletionSignal />
      )}

      <AuthBranch
        completionResult={completionResult}
        lessonHref={lessonHref}
        nextActivityHref={nextActivityHref}
        onRestart={onRestart}
      />

      <ContentFeedback className="pt-8" contentId={activityId} kind="activity" variant="minimal" />
    </CompletionScreen>
  );
}
