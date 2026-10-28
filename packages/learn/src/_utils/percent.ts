"use client";

import { formatGoalProgress } from "@zoonk/utils/number";
import { useFormatter } from "next-intl";
import { formatProgressShare } from "./progress-share";

/** Takes a share from 0 to 1. */
export function useFormatShare() {
  const format = useFormatter();

  return (share: number) => format.number(share, { maximumFractionDigits: 0, style: "percent" });
}

export function useFormatGoalProgress() {
  const format = useFormatter();
  return (share: number) => formatGoalProgress({ format, share });
}

export function useFormatProgressShare() {
  const formatShare = useFormatShare();
  return (share: number) => formatProgressShare({ formatShare, share });
}
