"use client";

import { useExtracted } from "next-intl";

const PERCENT = 100;

/** "+3 this week": preparation points gained, or nothing when the week didn't move it. */
export function useWeekGainText() {
  const t = useExtracted();

  return function weekGainText(gain: number): string | null {
    const points = Math.round(gain * PERCENT);

    if (points === 0) {
      return null;
    }

    return points > 0
      ? t("+{points, number} this week", { points })
      : t("{points, number} this week", { points });
  };
}
