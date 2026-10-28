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
 * Streams the learner summary into the frame on navigation, behind its neutral fallbacks.
 * The meta prevents the browser from fetching the same summary again while it streams.
 */
export function LearnerSummarySeed() {
  const seed = readSeedOnNavigation();

  return (
    <>
      <meta content="" name={LEARNER_SEED_META} />
      <Suspense fallback={null}>
        <ProvideLearnerSeed seed={seed} />
      </Suspense>
    </>
  );
}
