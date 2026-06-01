"use client";

import { useExtracted } from "next-intl";
import { usePlayerLessonMeta, usePlayerNavigation } from "../player-context";
import { LessonInfoPopover } from "./lesson-info-popover";
import { PlayerCloseLink, PlayerHeader } from "./player-header";
import { PlayerProgressBar } from "./player-progress-bar";

/**
 * Names the current lesson and its place in the chapter without competing with
 * the main step content. The header uses published-list counts from the route,
 * so learners see the same order they saw in the chapter lesson list.
 */
function HeaderLessonTitle() {
  const t = useExtracted();
  const { lessonProgress, lessonTitle } = usePlayerLessonMeta();

  const fullPositionLabel = t("Lesson {current} of {total}", {
    current: String(lessonProgress.currentLessonNumber),
    total: String(lessonProgress.totalLessonsInChapter),
  });

  return (
    <div className="flex w-full min-w-0 items-baseline justify-center gap-2 sm:flex-col sm:items-center sm:gap-0.5">
      <p
        aria-label={fullPositionLabel}
        className="text-muted-foreground shrink-0 text-sm leading-none font-medium tabular-nums sm:text-xs sm:leading-normal"
      >
        <span className="sm:hidden">
          {lessonProgress.currentLessonNumber}/{lessonProgress.totalLessonsInChapter}
        </span>
        <span className="hidden sm:inline">{fullPositionLabel}</span>
      </p>
      <p className="text-foreground min-w-0 truncate text-sm leading-none font-medium sm:leading-normal">
        {lessonTitle}
      </p>
    </div>
  );
}

export function InPlayStickyHeader({
  centerContent,
  progressValue,
}: {
  centerContent?: React.ReactNode;
  progressValue: number;
}) {
  const { chapterHref } = usePlayerNavigation();

  return (
    <div className="bg-background/95 sticky top-0 z-30 backdrop-blur-sm">
      <PlayerHeader>
        <PlayerCloseLink href={chapterHref} />

        <div className="min-w-0 flex-1 text-center">{centerContent ?? <HeaderLessonTitle />}</div>

        <LessonInfoPopover />
      </PlayerHeader>

      <PlayerProgressBar value={progressValue} />
    </div>
  );
}
