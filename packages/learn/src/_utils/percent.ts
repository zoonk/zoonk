"use client";

import { useFormatter } from "next-intl";
import { formatProgressShare } from "./progress-share";

/** View models send shares from 0 to 1; screens show whole percentages. */
export function useFormatShare() {
  const format = useFormatter();

  return (share: number) => format.number(share, { maximumFractionDigits: 0, style: "percent" });
}

/**
 * A plan's progress to the hundredth of a percent ("0.16%"): each lesson of a long plan moves it,
 * where a whole percentage would sit at "0%" for weeks.
 */
export function useFormatPlanProgress() {
  const format = useFormatter();

  return (share: number) => format.number(share, { maximumFractionDigits: 2, style: "percent" });
}

/** `formatProgressShare` in the learner's language. */
export function useFormatProgressShare() {
  const formatShare = useFormatShare();
  return (share: number) => formatProgressShare({ formatShare, share });
}
