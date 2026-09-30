"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { GaugeIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useScoreRange } from "../_utils/use-score-range";
import { usePreparation } from "./progress-context";

/**
 * The estimated score exists only after a mock exam, always as a range and always labeled
 * "Estimated", so it never reads as a promise.
 */
export function EstimatedScore() {
  const t = useExtracted();
  const scoreRange = useScoreRange();
  const score = usePreparation().estimatedScore;

  if (!score) {
    return null;
  }

  return (
    <div
      className="bg-muted flex items-start gap-3 rounded-2xl p-4 text-sm"
      data-slot="estimated-score"
    >
      <LineMarker aria-hidden="true">
        <GaugeIcon className="text-muted-foreground size-5" />
      </LineMarker>
      <div className="flex min-w-0 flex-col">
        <p>{t("Estimated score: {range}", { range: scoreRange(score) })}</p>
        <p className="text-muted-foreground text-xs">
          {t(
            "{count, plural, one {Based on your last mock exam} other {Based on your last # mock exams}}",
            { count: score.mocks },
          )}
        </p>
      </div>
    </div>
  );
}
