"use client";

import { useFormatter } from "next-intl";
import { formatProgressShare } from "./progress-share";

/** View models send shares from 0 to 1; screens show whole percentages. */
export function useFormatShare() {
  const format = useFormatter();

  return (share: number) => format.number(share, { maximumFractionDigits: 0, style: "percent" });
}

/** `formatProgressShare` in the learner's language. */
export function useFormatProgressShare() {
  const formatShare = useFormatShare();
  return (share: number) => formatProgressShare({ formatShare, share });
}
