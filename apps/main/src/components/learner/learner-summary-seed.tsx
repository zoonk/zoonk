import { type LearnerSummarySeedValue } from "@/lib/learner/learner-snapshot";
import { LEARNER_SEED_META } from "@/lib/learner/learner-store";
import { getLearnerSummary } from "@zoonk/core/learner/summary";
import { logError } from "@zoonk/utils/logger";
import { navigation } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { LearnerSummarySeedMerge } from "./learner-summary-seed-merge";

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

async function SeedRead() {
  await navigation();
  return <LearnerSummarySeedMerge seed={await readSeed()} />;
}

/**
 * Streams the learner summary in with a private section's pages (the tabs, settings, statistics,
 * onboarding), once as the learner enters it: never in a prefetch or the static shell. The meta
 * tells the browser the summary is on its way, so it doesn't read it again (`ensureLearnerSummary`).
 * The app's frame and every other page share the same summary in the browser.
 */
export function LearnerSummarySeed() {
  return (
    <>
      <meta content="" name={LEARNER_SEED_META} />
      <Suspense fallback={null}>
        <SeedRead />
      </Suspense>
    </>
  );
}
