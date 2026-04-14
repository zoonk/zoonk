"use client";

import { usePlayerActivityMeta, usePlayerNavigation } from "../player-context";
import { useActivityKindLabel } from "../use-activity-kind-label";
import { ContextRecallPopover } from "./context-recall-popover";
import { LessonInfoPopover } from "./lesson-info-popover";
import { PlayerCloseLink, PlayerHeader } from "./player-header";
import { PlayerProgressBar } from "./player-progress-bar";

export function InPlayStickyHeader({
  centerContent,
  contextRecall,
  progressValue,
}: {
  centerContent?: React.ReactNode;
  contextRecall: string | null;
  progressValue: number;
}) {
  const { kind, title } = usePlayerActivityMeta();
  const { lessonHref } = usePlayerNavigation();
  const kindLabel = useActivityKindLabel(kind);
  const displayTitle = title ?? kindLabel;

  return (
    <div className="bg-background/95 sticky top-0 z-30 backdrop-blur-sm">
      <PlayerHeader>
        <PlayerCloseLink href={lessonHref} />

        <div className="pointer-events-none absolute inset-x-0 flex justify-center">
          <div className="pointer-events-auto max-w-50 sm:max-w-75">
            {centerContent ?? (
              <span className="text-muted-foreground truncate text-sm">{displayTitle}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {contextRecall && <ContextRecallPopover content={contextRecall} />}

          <LessonInfoPopover />
        </div>
      </PlayerHeader>

      <PlayerProgressBar value={progressValue} />
    </div>
  );
}
