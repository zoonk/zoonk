"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useFormatShare } from "../_utils/percent";
import { PlanStatusLabel } from "../plan/plan-status-label";
import { EstimatedScore } from "./estimated-score";
import { ExamLink } from "./exam-link";
import { FadingSkills } from "./fading-skills";
import { MistakesLink } from "./mistakes-link";
import { PreparationParts } from "./preparation-parts";
import { ProgressAreas } from "./progress-areas";
import { usePreparation, useProgressScreen } from "./progress-context";
import { StatsLinks } from "./stats-links";
import { useWeekGainText } from "./use-share-delta";
import { WeeklySummary } from "./weekly-summary";

function ProgressHeadline() {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const weekGainText = useWeekGainText();
  const { progress } = useProgressScreen();
  const preparation = usePreparation();
  const gain = weekGainText(preparation.weekGain);

  return (
    <header className="flex flex-col gap-1">
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground min-w-0 text-sm">
          {t("{goal} preparation", { goal: progress.goal.title })}
        </p>
        {preparation.status && <PlanStatusLabel className="shrink-0" status={preparation.status} />}
      </div>
      <div className="flex items-baseline gap-3">
        <h1 aria-live="polite" className="text-5xl font-semibold tracking-tight tabular-nums">
          {formatShare(preparation.value)}
        </h1>
        {gain && (
          <span
            className={cn(
              "text-sm font-medium",
              preparation.weekGain > 0 ? "text-success" : "text-muted-foreground",
            )}
          >
            {gain}
          </span>
        )}
      </div>
      <p className="text-muted-foreground text-sm">
        {t(
          "How much of what your goal needs you already know well. It grows as you study and review.",
        )}
      </p>
    </header>
  );
}

/**
 * Focus's Progress: preparation with the evidence for each part, the estimated score after a mock,
 * each area with what's still needed to reach the goal there and practice on the weakest, the exam
 * and the mistakes notebook, what's fading, the week and the stats pages.
 */
export function FocusProgress() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <ProgressHeadline />
        <EstimatedScore />
        <PreparationParts />
      </div>
      <ProgressAreas />
      <div className="flex flex-col gap-2">
        <ExamLink />
        <MistakesLink />
      </div>
      <FadingSkills />
      <WeeklySummary />
      <StatsLinks />
    </div>
  );
}
