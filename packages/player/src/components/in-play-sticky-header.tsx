"use client";

import { type Route } from "next";
import { type DimensionInventory } from "../player-reducer";
import { DimensionHeaderStatus } from "./dimension-header-status";
import { PlayerCloseLink, PlayerHeader, PlayerStepFraction } from "./player-header";
import { PlayerProgressBar } from "./player-progress-bar";

export function InPlayStickyHeader({
  changedDimensions,
  currentStepIndex,
  dimensions,
  hasDimensions,
  lessonHref,
  progressValue,
  totalSteps,
}: {
  changedDimensions: Set<string>;
  currentStepIndex: number;
  dimensions: DimensionInventory;
  hasDimensions: boolean;
  lessonHref: Route;
  progressValue: number;
  totalSteps: number;
}) {
  return (
    <div className="bg-background/95 sticky top-0 z-30 backdrop-blur-sm">
      <PlayerHeader>
        <PlayerCloseLink href={lessonHref} />

        <div className="pointer-events-none absolute inset-x-0 flex justify-center">
          <div className="pointer-events-auto">
            {hasDimensions ? (
              <DimensionHeaderStatus
                changedDimensions={changedDimensions}
                dimensions={dimensions}
              />
            ) : (
              <PlayerStepFraction>
                {currentStepIndex + 1} / {totalSteps}
              </PlayerStepFraction>
            )}
          </div>
        </div>
      </PlayerHeader>

      <PlayerProgressBar value={progressValue} />
    </div>
  );
}
