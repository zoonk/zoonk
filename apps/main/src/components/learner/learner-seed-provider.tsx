"use client";

import {
  type LearnerSummarySeedValue,
  type LearnerSummaryState,
} from "@/lib/learner/learner-snapshot";
import { mergeLearnerSummarySeed } from "@/lib/learner/learner-store";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { createContext, use, useLayoutEffect, useState } from "react";

type Seed = Promise<LearnerSummarySeedValue>;

/**
 * Where the page tells the frame above it what its server render reads of the learner: it settles
 * with the summary once the read arrives, or null for a section without one.
 */
type SeedChannel = PromiseWithResolvers<LearnerSummarySeedValue | null>;

const LearnerSeedContext = createContext<SeedChannel | null>(null);

/**
 * The app's frame learns from the page under it what the server read of the learner
 * (`ProvideLearnerSeed`): the frame is drawn first, so it waits for that answer, which every
 * section of the app gives as it renders.
 */
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

/**
 * Answers the frame for one section of the app: the summary its server render reads
 * (`LearnerSummarySeed`), or `null` where the section stays static and the browser reads it (the
 * catalog). Given while rendering, so the frame above can use it in the same server render and in
 * hydration; only the first answer counts, and the store takes the summary as the page hydrates.
 */
export function ProvideLearnerSeed({ seed }: { seed: Seed | null }) {
  use(LearnerSeedContext)?.resolve(seed);
  return seed && <SeedMerge seed={seed} />;
}

/**
 * The learner as the frame draws them: the browser's summary, or until it holds one the summary
 * the page's server render read, so the server's HTML has them and hydration matches it. It waits
 * for that read under the caller's Suspense.
 */
export function useFrameLearner(): LearnerSummaryState {
  const state = useLearnerSummary();
  const channel = use(LearnerSeedContext);

  if (state.status !== "not-loaded" || !channel) {
    return state;
  }

  return use(channel.promise) ?? state;
}
