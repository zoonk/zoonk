"use client";

import { type Route } from "next";
import { type PlayerState } from "../player-reducer";
import { DimensionStatusButton } from "./dimension-status-button";
import {
  PlayerCloseLink,
  PlayerHeader,
  PlayerNav,
  PlayerNavButton,
  PlayerNavGroup,
  PlayerStepFraction,
} from "./player-header";
import { PlayerProgressBar } from "./player-progress-bar";

export function InPlayStickyHeader({
  currentStepIndex,
  dimensions,
  hasDimensions,
  isFirstStep,
  isStaticStep,
  lessonHref,
  onNavigateNext,
  onNavigatePrev,
  progressValue,
  totalSteps,
}: {
  currentStepIndex: number;
  dimensions: PlayerState["dimensions"];
  hasDimensions: boolean;
  isFirstStep: boolean;
  isStaticStep: boolean;
  lessonHref: Route;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  progressValue: number;
  totalSteps: number;
}) {
  return (
    <div className="bg-background/95 sticky top-0 z-30 backdrop-blur-sm">
      <PlayerHeader>
        <PlayerCloseLink href={lessonHref} />

        {isStaticStep && (
          <PlayerNav>
            <PlayerNavGroup>
              <PlayerNavButton direction="prev" disabled={isFirstStep} onClick={onNavigatePrev} />
              <PlayerStepFraction>
                {currentStepIndex + 1} / {totalSteps}
              </PlayerStepFraction>
              <PlayerNavButton direction="next" onClick={onNavigateNext} />
            </PlayerNavGroup>
          </PlayerNav>
        )}

        {!isStaticStep && (
          <PlayerStepFraction>
            {currentStepIndex + 1} / {totalSteps}
          </PlayerStepFraction>
        )}

        {hasDimensions ? (
          <DimensionStatusButton dimensions={dimensions} />
        ) : (
          <div className="size-9" aria-hidden="true" />
        )}
      </PlayerHeader>

      <PlayerProgressBar value={progressValue} />
    </div>
  );
}
