"use client";

import { useExtracted } from "next-intl";
import { FadingSkills } from "./fading-skills";
import { MistakesLink } from "./mistakes-link";
import { useProgressScreen } from "./progress-context";
import { StatsLinks } from "./stats-links";
import { WeeklySummary } from "./weekly-summary";

/**
 * Progress for a quick explanation: one answer isn't a goal to prepare for, so there's no
 * preparation, only what stays with the learner (fading ideas, the week) and the stats pages.
 * The same screen in both modes, styled by the mode's tokens.
 */
export function ExplanationProgress() {
  const t = useExtracted();
  const { progress } = useProgressScreen();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="in-data-[mode=fun]:font-fun-display text-2xl font-semibold tracking-tight">
          {progress.goal.title}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t(
            "A quick explanation has nothing to prepare for. Its ideas come back in your reviews so they stay with you.",
          )}
        </p>
      </header>
      <MistakesLink />
      <FadingSkills />
      <WeeklySummary />
      <StatsLinks />
    </div>
  );
}
