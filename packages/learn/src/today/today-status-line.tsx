"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useFormatShare } from "../_utils/percent";
import { PlanStatusLabel } from "../plan/plan-status-label";
import { useTodayScreen } from "./today-context";

/** Less than half a point of preparation reads as no change, so it isn't announced. */
const MIN_WEEK_GAIN = 0.005;
const SEPARATOR = "· ";

/**
 * "On track · preparation 58% · +3% this week": one line, the same numbers in both modes. The
 * estimated score never shows here; it lives in Progress after a mock.
 */
export function TodayStatusLine({ className }: { className?: string }) {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const { today } = useTodayScreen();
  const { progress } = today;

  if (!progress) {
    return null;
  }

  const showGain = progress.weekGain >= MIN_WEEK_GAIN;

  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-sm", className)}>
      {progress.status && <PlanStatusLabel status={progress.status} />}

      <span className="text-muted-foreground">
        {progress.status && <span aria-hidden="true">{SEPARATOR}</span>}
        {t("preparation {value}", { value: formatShare(progress.value) })}
      </span>

      {showGain && (
        <span className="text-success font-medium">
          {t("+{gain} this week", { gain: formatShare(progress.weekGain) })}
        </span>
      )}
    </p>
  );
}
