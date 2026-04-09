"use client";

import { useExtracted } from "next-intl";
import { METRIC_AVERAGE_THRESHOLD } from "../story";
import {
  PlayerReadSceneBody,
  PlayerReadSceneDivider,
  PlayerReadSceneStack,
} from "./player-read-scene";
import { StoryMetricPill } from "./story-metric-pill";

/**
 * Intro screen for a story activity.
 *
 * Sets the scene with narrative text and shows the initial metric values
 * using the same pill components as the in-game metrics bar.
 * Typography-forward design — the writing IS the visual. No emoji, no images.
 *
 * Layout hierarchy:
 * 1. Narrative text (hero) — large, confident, draws you in
 * 2. Thin divider — clean visual break between story and game state
 * 3. Metrics pills — same style as the persistent bar during gameplay
 */
export function StoryIntroContent({ intro, metrics }: { intro: string; metrics: string[] }) {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-10">
      <PlayerReadSceneBody>{intro}</PlayerReadSceneBody>

      <PlayerReadSceneStack className="gap-4">
        <PlayerReadSceneDivider />

        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
            {t("Current status")}
          </p>

          <div className="-ml-1 flex flex-wrap gap-2">
            {metrics.map((metric) => (
              <StoryMetricPill key={metric} metric={metric} value={METRIC_AVERAGE_THRESHOLD} />
            ))}
          </div>
        </div>
      </PlayerReadSceneStack>
    </div>
  );
}
