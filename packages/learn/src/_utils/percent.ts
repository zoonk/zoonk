"use client";

import { useFormatter } from "next-intl";

/** View models send shares from 0 to 1; screens show whole percentages. */
export function useFormatShare() {
  const format = useFormatter();

  return (share: number) => format.number(share, { maximumFractionDigits: 0, style: "percent" });
}
