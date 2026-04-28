"use client";

import { usePlayerLessonMeta, usePlayerNavigation } from "../player-context";
import { useLessonKindLabel } from "../use-lesson-kind-label";
import { LessonInfoPopover } from "./lesson-info-popover";
import { PlayerCloseLink, PlayerHeader } from "./player-header";
import { PlayerProgressBar } from "./player-progress-bar";

export function InPlayStickyHeader({
  centerContent,
  progressValue,
}: {
  centerContent?: React.ReactNode;
  progressValue: number;
}) {
  const { kind, title } = usePlayerLessonMeta();
  const { lessonHref } = usePlayerNavigation();
  const kindLabel = useLessonKindLabel(kind);
  const displayTitle = title ?? kindLabel;

  return (
    <div className="bg-background/95 sticky top-0 z-30 backdrop-blur-sm">
      <PlayerHeader>
        <PlayerCloseLink href={lessonHref} />

        <div className="min-w-0 flex-1 text-center">
          {centerContent ?? (
            <p className="text-muted-foreground truncate text-sm">{displayTitle}</p>
          )}
        </div>

        <LessonInfoPopover />
      </PlayerHeader>

      <PlayerProgressBar value={progressValue} />
    </div>
  );
}
