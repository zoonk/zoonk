"use client";

import { type CompletionResult } from "@zoonk/core/player/contracts/completion-input-schema";
import { ProgressIndicator, ProgressRoot, ProgressTrack } from "@zoonk/ui/components/progress";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheck } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  type PlayerLessonProgress,
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
 * Converts 1-based chapter position into a bounded percentage for the progress
 * bar. The route already guards stale curriculum lists, but this keeps the UI
 * readable if a fallback payload reaches the shared player.
 */
function getChapterProgressValue({
  currentLessonNumber,
  totalLessonsInChapter,
}: PlayerLessonProgress) {
  const total = Math.max(totalLessonsInChapter, currentLessonNumber, 1);
  const current = Math.min(Math.max(currentLessonNumber, 1), total);

  return Math.round((current / total) * 100);
}

/**
 * Shows chapter position as a quiet completion detail instead of another score
 * or reward. The visible label makes the bar unambiguous on small screens.
 */
function CompletionChapterProgress({ lessonProgress }: { lessonProgress: PlayerLessonProgress }) {
  const t = useExtracted();

  const progressLabel = t("Lesson {current} of {total}", {
    current: String(lessonProgress.currentLessonNumber),
    total: String(lessonProgress.totalLessonsInChapter),
  });

  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-2">
      <ProgressRoot
        aria-label={t("Chapter progress")}
        aria-valuetext={progressLabel}
        className="w-full gap-0"
        value={getChapterProgressValue(lessonProgress)}
      >
        <ProgressTrack className="h-1.5 rounded-full">
          <ProgressIndicator className="rounded-full" />
        </ProgressTrack>
      </ProgressRoot>

      <PlayerSupportingText>{progressLabel}</PlayerSupportingText>
    </div>
  );
}

/**
 * Adds the exact lesson title and chapter position to completion screens.
 * This keeps orientation near the score while avoiding reward-like badges or
 * ambiguous remaining-work copy.
 */
function CompletionLessonContext({ milestone }: { milestone: PlayerMilestone | null }) {
  const { lessonProgress, lessonTitle } = usePlayerLessonMeta();

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3 text-center">
      <p className="text-foreground text-base leading-snug font-medium">{lessonTitle}</p>

      <CompletionChapterProgress lessonProgress={lessonProgress} />

      {milestone && (
        <PlayerSupportingText>
          <RemainingChaptersText count={lessonProgress.remainingChaptersInCourse} />
        </PlayerSupportingText>
      )}
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
            chapterHref={chapterHref}
            nextLessonHref={nextLessonHref}
            onRestart={onRestart}
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

      <AuthBranch chapterHref={chapterHref} nextLessonHref={nextLessonHref} onRestart={onRestart} />

      {completionFooter}
    </CompletionScreen>
  );
}
