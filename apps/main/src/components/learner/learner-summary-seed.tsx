import { type LearnerSummarySeedValue } from "@/lib/learner/learner-snapshot";
import { LEARNER_SEED_META } from "@/lib/learner/learner-store";
import { getLearnerSummary } from "@zoonk/core/learner/summary";
import { logError } from "@zoonk/utils/logger";
import { navigation } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { ProvideLearnerSeed } from "./learner-seed-provider";

/** A summary that can't be read leaves the frame's neutral look, not the page. */
async function readSeed(): Promise<LearnerSummarySeedValue> {
  try {
    const summary = await getLearnerSummary();
    return summary ? { status: "ready", summary } : { status: "visitor" };
  } catch (error) {
    // Next's own signals (dynamic rendering, redirects) must keep propagating.
    unstable_rethrow(error);
    logError("Learner summary failed to load", { error });
    return { status: "failed" };
  }
}

/** Read as the learner opens one of the section's pages: never for a prefetch or the static shell. */
async function readSeedOnNavigation(): Promise<LearnerSummarySeedValue> {
  await navigation();
  return readSeed();
}

/**
 * Streams the learner summary in with a private section's pages (the tabs, settings, statistics,
 * onboarding), once as the learner enters it: never in a prefetch or the static shell. The app's
 * frame draws the learner's goal, level, tabs, places and account from it in the server's HTML,
 * with the page, instead of once the page's code has loaded (`useFrameLearner`). The meta tells
 * the browser the summary is on its way, so it doesn't read it again (`ensureLearnerSummary`);
 * the frame and every other page share it in the browser.
 */
export function LearnerSummarySeed() {
  return (
    <>
      <meta content="" name={LEARNER_SEED_META} />
      <Suspense fallback={null}>
        <ProvideLearnerSeed seed={readSeedOnNavigation()} />
      </Suspense>
    </>
  );
}
