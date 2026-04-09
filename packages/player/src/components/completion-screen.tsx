"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheck } from "lucide-react";
import { useExtracted } from "next-intl";
import { type CompletionResult } from "../completion-input-schema";
import { type PlayerRoute, usePlayerMilestone, usePlayerViewer } from "../player-context";
import { AuthBranch } from "./completion-auth-branch";
import { PlayerContentFrame } from "./step-layouts";

/**
 * Completion lives on the same centered frame as the rest of the player so
 * score summaries and follow-up actions don't introduce another width system.
 */
function CompletionScreen({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <PlayerContentFrame
      aria-live="polite"
      className={cn("my-auto flex flex-col items-center gap-6", className)}
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

export function CompletionScreenContent({
  completionResult,
  lessonHref,
  nextActivityHref,
  onRestart,
}: {
  completionResult: CompletionResult | null;
  lessonHref: PlayerRoute;
  nextActivityHref: PlayerRoute | null;
  onRestart: () => void;
}) {
  const t = useExtracted();
  const milestone = usePlayerMilestone();
  const { completionFooter } = usePlayerViewer();

  if (milestone.kind !== "activity") {
    return (
      <CompletionScreen className="min-h-[60vh] justify-center gap-10 sm:gap-12">
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

  const totalCount = completionResult
    ? completionResult.correctCount + completionResult.incorrectCount
    : 0;

  return (
    <CompletionScreen>
      {totalCount > 0 && completionResult ? (
        <CompletionScore>
          <p className="text-5xl font-bold tracking-tight tabular-nums">
            {completionResult.correctCount}/{totalCount}
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
