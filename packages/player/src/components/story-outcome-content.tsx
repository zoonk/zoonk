"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { type StoryAlignment } from "@zoonk/core/steps/contract/content";
import { type StepImage } from "@zoonk/core/steps/contract/image";
import { type StoryOutcomeTier } from "@zoonk/utils/activities";
import { useExtracted } from "next-intl";
import { usePlayerRuntime } from "../player-context";
import { type PlayerState } from "../player-reducer";
import { findSelectedStoryOption, getStoryMetrics } from "../player-selectors";
import { getStoryOutcomeDisplayTier } from "../story-outcome";
import {
  PlayerReadSceneBody,
  PlayerReadSceneDivider,
  PlayerReadSceneMetaLabel,
  PlayerReadSceneStack,
  PlayerReadSceneTitle,
  type PlayerReadSceneTitleTone,
} from "./player-read-scene";
import { StepActionButton } from "./step-action-button";
import { StepHero } from "./step-intro-hero-layout";
import { StoryMetricPill } from "./story-metric-pill";

type StoryOutcome = {
  image?: StepImage;
  narrative: string;
  title: string;
};

type StoryOutcomes = Record<StoryOutcomeTier, StoryOutcome>;

/**
 * Reads the selected alignment for one story step. Missing or stale answers
 * count as weak so incomplete state cannot accidentally improve the ending.
 */
function getStoryStepAlignment({
  results,
  step,
}: {
  results: PlayerState["results"];
  step: SerializedStep;
}): StoryAlignment {
  const option = findSelectedStoryOption({ results, step });
  return option?.alignment ?? "weak";
}

/**
 * Returns the alignment contribution for one step. Non-story steps contribute
 * nothing because only story decisions should affect the ending tier.
 */
function getStoryAlignmentEntry({
  results,
  step,
}: {
  results: PlayerState["results"];
  step: SerializedStep;
}): StoryAlignment[] {
  if (step.kind !== "story") {
    return [];
  }

  return [getStoryStepAlignment({ results, step })];
}

/**
 * Extracts the story decision alignments in activity order so the pure tier
 * selector can score the ending without knowing about player state shape.
 */
function getStoryAlignments({
  results,
  steps,
}: {
  results: PlayerState["results"];
  steps: SerializedStep[];
}): StoryAlignment[] {
  return steps.flatMap((step) => getStoryAlignmentEntry({ results, step }));
}

/**
 * Returns the semantic title tone for the selected fixed outcome tier.
 */
function getOutcomeTierTone(tier: StoryOutcomeTier): PlayerReadSceneTitleTone {
  if (tier === "perfect" || tier === "good") {
    return "success";
  }

  if (tier === "bad" || tier === "terrible") {
    return "destructive";
  }

  return "warning";
}

/**
 * Outcome screen shown after the final decision step feedback.
 *
 * Displays the narrative result of the player's decisions with a
 * tone-coded title reflecting how well they did.
 */
export function StoryOutcomeContent({ outcomes }: { outcomes: StoryOutcomes }) {
  const t = useExtracted();
  const { state } = usePlayerRuntime();
  const tier = getStoryOutcomeDisplayTier(getStoryAlignments(state));
  const storyMetrics = getStoryMetrics(state);

  const outcome = outcomes[tier];
  const titleTone = getOutcomeTierTone(tier);

  return (
    <StepHero image={outcome.image}>
      <div className="flex flex-col gap-6">
        <PlayerReadSceneStack>
          <PlayerReadSceneTitle tone={titleTone}>{outcome.title}</PlayerReadSceneTitle>
          <PlayerReadSceneBody>{outcome.narrative}</PlayerReadSceneBody>
        </PlayerReadSceneStack>

        {storyMetrics.length > 0 && (
          <PlayerReadSceneStack className="gap-2">
            <PlayerReadSceneDivider />

            <PlayerReadSceneMetaLabel>{t("Final status")}</PlayerReadSceneMetaLabel>

            <div className="-ml-1 flex flex-wrap gap-2">
              {storyMetrics.map((entry) => (
                <StoryMetricPill key={entry.metric} metric={entry.metric} value={entry.value} />
              ))}
            </div>
          </PlayerReadSceneStack>
        )}

        <StepActionButton />
      </div>
    </StepHero>
  );
}
