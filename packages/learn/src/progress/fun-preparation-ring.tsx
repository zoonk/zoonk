"use client";

import { type ProgressView } from "@zoonk/core/view-models/progress/get";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { useFormatShare } from "../_utils/percent";
import { useScoreRange } from "../_utils/use-score-range";
import { usePreparation, useProgressScreen } from "./progress-context";
import { useWeekGainText } from "./use-share-delta";
import { useStageName } from "./use-stage-name";

const RING_SIZE = 240;
const RING_STROKE = 14;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

type Stage = NonNullable<ProgressView["preparation"]>["stage"];

const STAGES: Stage[] = ["building", "growing", "solid"];

/** "Just started" joins the row only while it's the current stage, so the row always marks one. */
function getStages(stage: Stage): Stage[] {
  return stage === "starting" ? ["starting", ...STAGES] : STAGES;
}

/**
 * Preparation as a ring around the destination planet. The ring fills with the same number Focus
 * shows as bars; the stages below it end at "Solid" and always mark the current one.
 */
export function FunPreparationRing() {
  const t = useExtracted();
  const gradientId = useId();
  const formatShare = useFormatShare();
  const scoreRange = useScoreRange();
  const stageName = useStageName();
  const weekGainText = useWeekGainText();
  const { progress } = useProgressScreen();
  const { estimatedScore, stage, value, weekGain } = usePreparation();
  const gain = weekGainText(weekGain);

  return (
    <section aria-labelledby="fun-ring-title" className="flex flex-col items-center gap-4">
      <div className="relative" style={{ height: RING_SIZE, width: RING_SIZE }}>
        <svg
          aria-hidden="true"
          className="-rotate-90"
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          width={RING_SIZE}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--fun-accent-cyan)" />
              <stop offset="60%" stopColor="var(--fun-accent-violet)" />
              <stop offset="100%" stopColor="var(--fun-accent-pink)" />
            </linearGradient>
          </defs>
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            fill="none"
            r={RING_RADIUS}
            stroke="var(--fun-track)"
            strokeWidth={RING_STROKE}
          />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            fill="none"
            r={RING_RADIUS}
            stroke={`url(#${gradientId})`}
            strokeDasharray={`${RING_LENGTH * value} ${RING_LENGTH}`}
            strokeLinecap="round"
            strokeWidth={RING_STROKE}
          />
        </svg>
        <span aria-hidden="true" className="fun-planet absolute inset-12 block" />
      </div>

      <div className="flex flex-col items-center gap-1 text-center">
        <p aria-live="polite" className="font-fun-display text-5xl font-bold tabular-nums">
          {formatShare(value)}
        </p>
        <h1 className="text-fun-fg2 text-base" id="fun-ring-title">
          {t("{goal} preparation", { goal: progress.goal.title })}
        </h1>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {estimatedScore && (
          <span className="fun-glass rounded-full px-3 py-1.5 text-sm">
            {t("Estimated {range}", { range: scoreRange(estimatedScore) })}
          </span>
        )}
        {gain && (
          <span
            className={cn(
              "fun-glass rounded-full px-3 py-1.5 text-sm font-semibold",
              weekGain > 0 ? "text-fun-accent-lime" : "text-fun-fg2",
            )}
          >
            {gain}
          </span>
        )}
      </div>

      {/* Stage names run long in some languages: each stays on one line and the row wraps. */}
      <ol aria-label={t("Stages")} className="flex flex-wrap justify-center gap-x-1 gap-y-2">
        {getStages(stage).map((item) => (
          <li
            aria-current={item === stage ? "step" : undefined}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap",
              item === stage ? "fun-inv" : "text-fun-fg3",
            )}
            key={item}
          >
            {stageName(item)}
          </li>
        ))}
      </ol>
    </section>
  );
}
