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

        <div className="min-w-0 flex-1 text-center">
          {centerContent ?? (
            <p className="text-muted-foreground truncate text-sm">{displayTitle}</p>
          )}
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
