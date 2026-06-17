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

/**
 * Converts the raw correct/incorrect counts into the score users expect to see
 * on completion. The persisted score still keeps counts, but the summary reads
 * as accuracy, so a whole percentage is easier to scan than a fraction.
 */
function getCompletionScorePercent({
  correctCount,
  totalCount,
}: {
  correctCount: number;
  totalCount: number;
}) {
  if (totalCount === 0) {
    return 0;
  }

  return Math.round((correctCount / totalCount) * 100);
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
 * Groups the focused context below a completion or milestone headline. Both
 * regular lesson completion and structural milestones need the same centered
 * width, spacing, and text alignment, so keeping this chrome in one component
 * prevents the two branches from drifting as the screen evolves.
 */
function CompletionContext({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex w-full max-w-md flex-col items-center gap-3 text-center", className)}
      data-slot="completion-context"
      {...props}
    />
  );
}

/**
 * Renders the main context label with the shared completion typography. Callers
 * can choose the exact text size for the screen hierarchy while the color,
 * weight, and line-height stay consistent.
 */
function CompletionContextTitle({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-foreground leading-snug font-medium", className)}
      data-slot="completion-context-title"
      {...props}
    />
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
function CompletionLessonContext() {
  const { lessonProgress, lessonTitle } = usePlayerLessonMeta();

  return (
    <CompletionContext>
      <CompletionContextTitle className="text-base">{lessonTitle}</CompletionContextTitle>

      <CompletionChapterProgress lessonProgress={lessonProgress} />
    </CompletionContext>
  );
}

/**
 * Picks the completed curriculum title for structural completion milestones.
 * A chapter milestone should orient the learner around the finished chapter,
 * while a course milestone should celebrate the finished course instead of the
 * final lesson that happened to trigger completion.
 */
function getMilestoneTitle({
  chapterTitle,
  courseTitle,
  milestone,
}: {
  chapterTitle: string;
  courseTitle: string;
  milestone: PlayerMilestone;
}) {
  if (milestone.kind === "course") {
    return courseTitle;
  }

  return chapterTitle;
}

/**
 * Structural milestones should be quiet and focused: the milestone label plus
 * the curriculum title are enough. Lesson score, lesson title, and chapter
 * position stay on the ordinary completion screen where they belong.
 */
function CompletionMilestoneContext({ milestone }: { milestone: PlayerMilestone }) {
  const { chapterTitle, courseTitle } = usePlayerLessonMeta();
  const milestoneTitle = getMilestoneTitle({ chapterTitle, courseTitle, milestone });

  return (
    <CompletionContext>
      <MilestoneHeading milestone={milestone} />
      <CompletionContextTitle className="text-lg sm:text-xl">
        {milestoneTitle}
      </CompletionContextTitle>
    </CompletionContext>
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
  const { completionFooter, isAuthenticated } = usePlayerViewer();

  if (!isAuthenticated) {
    return (
      <CompletionScreen className="min-h-[60vh] justify-center">
        <AuthBranch
          chapterHref={chapterHref}
          nextLessonHref={nextLessonHref}
          onRestart={onRestart}
        />
      </CompletionScreen>
    );
  }

  if (milestone) {
    return (
      <CompletionScreen className="min-h-[60vh] justify-center gap-6 sm:gap-8">
        <CompletionMilestoneContext milestone={milestone} />

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

  const scorePercent = completionResult
    ? getCompletionScorePercent({ correctCount: completionResult.correctCount, totalCount })
    : 0;

  return (
    <CompletionScreen>
      {totalCount > 0 && completionResult ? (
        <CompletionScore>
          <p className="text-5xl font-bold tracking-tight tabular-nums">{scorePercent}%</p>
          <PlayerSupportingText>{t("correct")}</PlayerSupportingText>
        </CompletionScore>
      ) : (
        <CompletionSignal />
      )}

      <CompletionLessonContext />

      <AuthBranch chapterHref={chapterHref} nextLessonHref={nextLessonHref} onRestart={onRestart} />

      {completionFooter}
    </CompletionScreen>
  );
}
