"use client";

import {
  type LearnerSummarySeedValue,
  type LearnerSummaryState,
} from "@/lib/learner/learner-snapshot";
import { mergeLearnerSummarySeed } from "@/lib/learner/learner-store";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { createContext, use, useLayoutEffect, useState } from "react";

type Seed = Promise<LearnerSummarySeedValue>;

type SeedChannel = PromiseWithResolvers<LearnerSummarySeedValue | null>;

const LearnerSeedContext = createContext<SeedChannel | null>(null);

/** The frame is drawn before the page under it, so it waits for the page's answer. */
export function LearnerSeedChannel({ children }: { children: React.ReactNode }) {
  // oxlint-disable-next-line react/hook-use-state -- Made once and never replaced, so there is no setter.
  const [channel] = useState(() => Promise.withResolvers<LearnerSummarySeedValue | null>());
  return <LearnerSeedContext value={channel}>{children}</LearnerSeedContext>;
}

function SeedMerge({ seed }: { seed: Seed }) {
  const value = use(seed);

  useLayoutEffect(() => {
    mergeLearnerSummarySeed(value);
  }, [value]);

  return null;
}

/** Given while rendering, so the frame can use it in the same server render and hydration; only the first counts. */
export function ProvideLearnerSeed({ seed }: { seed: Seed | null }) {
  use(LearnerSeedContext)?.resolve(seed);
  return seed && <SeedMerge seed={seed} />;
}

/** Until the browser holds a summary, the server render's, so hydration matches the server's HTML. */
export function useFrameLearner(): LearnerSummaryState {
  const state = useLearnerSummary();
  const channel = use(LearnerSeedContext);

  if (state.status !== "not-loaded" || !channel) {
    return state;
  }

  return use(channel.promise) ?? state;
}
