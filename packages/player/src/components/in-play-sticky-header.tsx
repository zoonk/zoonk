"use client";

import { type Route } from "next";
import { type DimensionInventory } from "../player-reducer";
import { DimensionScoreBar } from "./dimension-score-bar";
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

        <PlayerStepFraction>
          {currentStepIndex + 1} / {totalSteps}
        </PlayerStepFraction>

        <div className="size-9" aria-hidden="true" />
      </PlayerHeader>

      <PlayerProgressBar value={progressValue} />

      {hasDimensions && (
        <DimensionScoreBar changedDimensions={changedDimensions} dimensions={dimensions} />
      )}
    </div>
  );
}
