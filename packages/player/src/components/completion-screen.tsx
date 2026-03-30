"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheck } from "lucide-react";
import { useExtracted } from "next-intl";
import { type CompletionResult } from "../completion-input-schema";
import { computeScore } from "../compute-score";
import {
  type PlayerRoute,
  usePlayerMilestone,
  usePlayerRuntime,
  usePlayerViewer,
} from "../player-context";
import { type StepResult } from "../player-reducer";
import { AuthBranch } from "./completion-auth-branch";

function CompletionScreen({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "animate-in fade-in mx-auto my-auto flex w-full max-w-lg flex-col items-center gap-6 duration-200 ease-out motion-reduce:animate-none",
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

function MilestoneHeading() {
  const t = useExtracted();
  const milestone = usePlayerMilestone();

  function getHeading() {
    if (milestone.kind === "course") {
      return t("Course Complete");
    }

    if (milestone.kind === "chapter") {
      return t("Chapter Complete");
    }

    return t("Lesson Complete");
  }

  return <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{getHeading()}</h2>;
}

/**
 * Computes the score display for the completion screen.
 *
 * Tradeoff steps are excluded because they have no correct/incorrect
 * answer — showing "3/3 correct" would be misleading. When only
 * tradeoff + static steps exist, returns null so the screen shows
 * the "Completed" checkmark instead.
 */
function getCompletionScore(results: Record<string, StepResult>, tradeoffStepIds: Set<string>) {
  const scorableResults = Object.entries(results)
    .filter(([stepId]) => !tradeoffStepIds.has(stepId))
    .map(([_, stepResult]) => ({ isCorrect: stepResult.result.isCorrect }));

  if (scorableResults.length === 0) {
    return null;
  }

  const score = computeScore({ results: scorableResults });
  return { correctCount: score.correctCount, totalCount: scorableResults.length };
}

export function CompletionScreenContent({
  completionResult,
  lessonHref,
  nextActivityHref,
  onRestart,
  results,
}: {
  completionResult: CompletionResult | null;
  lessonHref: PlayerRoute;
  nextActivityHref: PlayerRoute | null;
  onRestart: () => void;
  results: Record<string, StepResult>;
}) {
  const t = useExtracted();
  const { state } = usePlayerRuntime();
  const milestone = usePlayerMilestone();
  const { completionFooter } = usePlayerViewer();

  if (milestone.kind !== "activity") {
    return (
      <CompletionScreen className="min-h-[60vh] max-w-sm justify-center gap-10 px-6 sm:gap-12">
        <MilestoneHeading />

        <div className="flex w-full flex-col gap-3">
          <AuthBranch
            completionResult={completionResult}
            lessonHref={lessonHref}
            nextActivityHref={nextActivityHref}
            onRestart={onRestart}
            showRewards={false}
          />
        </div>
      </CompletionScreen>
    );
  }

  const tradeoffStepIds = new Set(
    state.steps.filter((step) => step.kind === "tradeoff").map((step) => step.id),
  );
  const score = getCompletionScore(results, tradeoffStepIds);

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

      {completionFooter}
    </CompletionScreen>
  );
}
