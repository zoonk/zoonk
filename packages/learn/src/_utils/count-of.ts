"use client";

import { useExtracted } from "next-intl";

/** How many of a set are done, written one way on every screen: "1 of 6", never "1/6". */
export function useCountOf() {
  const t = useExtracted();

  return (done: number, total: number): string =>
    t("{done, number} of {total, number}", { done, total });
}
