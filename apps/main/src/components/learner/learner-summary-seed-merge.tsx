"use client";

import { type LearnerSummarySeedValue } from "@/lib/learner/learner-snapshot";
import { mergeLearnerSummarySeed } from "@/lib/learner/learner-store";
import { useLayoutEffect } from "react";

/** Hands the server's read to the store before the frame paints from it. */
export function LearnerSummarySeedMerge({ seed }: { seed: LearnerSummarySeedValue }) {
  useLayoutEffect(() => {
    mergeLearnerSummarySeed(seed);
  }, [seed]);

  return null;
}
