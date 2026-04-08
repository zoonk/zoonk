"use client";

import { type PlayerRoute } from "../player-context";
import { InvestigationScenarioPopover } from "./investigation-scenario-popover";
import { PlayerCloseLink, PlayerHeader, PlayerStepFraction } from "./player-header";
import { PlayerProgressBar } from "./player-progress-bar";
import { StoryBriefingPopover } from "./story-briefing-popover";

export function InPlayStickyHeader({
  currentStepIndex,
  investigationScenario,
  lessonHref,
  progressValue,
  storyBriefing,
  totalSteps,
}: {
  currentStepIndex: number;
  investigationScenario: { scenario: string } | null;
  lessonHref: PlayerRoute;
  progressValue: number;
  storyBriefing: string | null;
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

        {storyBriefing && <StoryBriefingPopover intro={storyBriefing} />}
        {investigationScenario && (
          <InvestigationScenarioPopover scenario={investigationScenario.scenario} />
        )}
      </PlayerHeader>

      <PlayerProgressBar value={progressValue} />
    </div>
  );
}
