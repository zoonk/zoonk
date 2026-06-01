"use client";

import { type CompletionResult } from "@zoonk/core/player/contracts/completion-input-schema";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheck } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  type PlayerMilestone,
  type PlayerRoute,
  usePlayerLessonMeta,
  usePlayerMilestone,
  usePlayerViewer,
} from "../player-context";
import { AuthBranch } from "./completion-auth-branch";
import { PlayerSupportingText } from "./player-supporting-text";
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

function MilestoneHeading({ milestone }: { milestone: PlayerMilestone }) {
  const t = useExtracted();

  function getHeading() {
    if (milestone.kind === "course") {
      return t("Course Complete");
    }

    return t("Chapter Complete");
  }

  return <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{getHeading()}</h2>;
}

/**
 * Keeps lesson-count grammar in one ICU message instead of branching in code.
 * Translators can handle zero, singular, and plural forms according to each
 * locale while the component only passes the remaining count.
 */
function RemainingLessonsText({ count }: { count: number }) {
  const t = useExtracted();

  return t(
    "{count, plural, =0 {No lessons left in this chapter} one {# lesson left in this chapter} other {# lessons left in this chapter}}",
    { count },
  );
}

/**
 * Keeps chapter-count grammar in one ICU message. Course completion naturally
 * becomes the zero case, while chapter milestones use the locale's singular
 * and plural rules for the remaining chapter count.
 */
function RemainingChaptersText({ count }: { count: number }) {
  const t = useExtracted();

  return t(
    "{count, plural, =0 {No chapters left in this course} one {# chapter left in this course} other {# chapters left in this course}}",
    { count },
  );
}

/**
 * Adds the exact lesson title and the next curriculum count to completion
 * screens. The detail is intentionally text-only so the page gains orientation
 * without another badge, card, or decorative element.
 */
function CompletionLessonContext({ milestone }: { milestone: PlayerMilestone | null }) {
  const { lessonProgress, lessonTitle } = usePlayerLessonMeta();

  return (
    <div className="flex max-w-md flex-col items-center gap-1 text-center">
      <p className="text-foreground text-base leading-snug font-medium">{lessonTitle}</p>
      <PlayerSupportingText>
        {milestone ? (
          <RemainingChaptersText count={lessonProgress.remainingChaptersInCourse} />
        ) : (
          <RemainingLessonsText count={lessonProgress.remainingLessonsInChapter} />
        )}
      </PlayerSupportingText>
    </div>
  );
}

export function CompletionScreenContent({
  completionResult,
  chapterHref,
  nextLessonHref,
  onRestart,
}: {
  chapterHref: PlayerRoute;
  completionResult: CompletionResult | null;
  nextLessonHref: PlayerRoute | null;
  onRestart: () => void;
}) {
  const t = useExtracted();
  const milestone = usePlayerMilestone();
  const { completionFooter } = usePlayerViewer();

  if (milestone) {
    return (
      <CompletionScreen className="min-h-[60vh] justify-center gap-6 sm:gap-8">
        <div className="flex flex-col items-center gap-3">
          <MilestoneHeading milestone={milestone} />
          <CompletionLessonContext milestone={milestone} />
        </div>

        <div className="flex w-full flex-col gap-3">
          <AuthBranch
            completionResult={completionResult}
            chapterHref={chapterHref}
            nextLessonHref={nextLessonHref}
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
          <PlayerSupportingText>{t("correct")}</PlayerSupportingText>
        </CompletionScore>
      ) : (
        <CompletionSignal />
      )}

      <CompletionLessonContext milestone={milestone} />

      <AuthBranch
        completionResult={completionResult}
        chapterHref={chapterHref}
        nextLessonHref={nextLessonHref}
        onRestart={onRestart}
      />

      {completionFooter}
    </CompletionScreen>
  );
}
