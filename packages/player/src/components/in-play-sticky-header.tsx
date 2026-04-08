"use client";

import { type PlayerRoute } from "../player-context";
import { ContextRecallPopover } from "./context-recall-popover";
import { PlayerCloseLink, PlayerHeader, PlayerStepFraction } from "./player-header";
import { PlayerProgressBar } from "./player-progress-bar";

export function InPlayStickyHeader({
  contextRecall,
  currentStepIndex,
  lessonHref,
  progressValue,
  totalSteps,
}: {
  contextRecall: string | null;
  currentStepIndex: number;
  lessonHref: PlayerRoute;
  progressValue: number;
  totalSteps: number;
}) {
  return (
    <div className="bg-background/95 sticky top-0 z-30 backdrop-blur-sm">
      <PlayerHeader>
        <PlayerCloseLink href={lessonHref} />

        <div className="pointer-events-none absolute inset-x-0 flex justify-center">
          <div className="pointer-events-auto">
            <PlayerStepFraction>
              {currentStepIndex + 1} / {totalSteps}
            </PlayerStepFraction>
          </div>
        </div>

        {contextRecall && <ContextRecallPopover content={contextRecall} />}
      </PlayerHeader>

      <PlayerProgressBar value={progressValue} />
    </div>
  );
}
