import { HoldFirstPaint } from "@/components/first-paint-content";
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

/** The end of the learner's read in the document, which a hard load's first paint waits for. */
const SEED_END_ID = "learner-seed-end";

/**
 * How long the first paint waits for the learner at most, from when the page's styles loaded: on
 * a fast connection they arrive within it, so the page paints once with its frame; on a slow one,
 * where they can stream a second after the page's content, the content doesn't wait for them.
 */
const SEED_MAX_WAIT_MS = 100;

/** Rendered once the summary is read, so it streams with the frame's learner. */
async function SeedEnd({ seed }: { seed: Promise<LearnerSummarySeedValue> }) {
  await seed;
  return <template id={SEED_END_ID} />;
}

/**
 * Streams the learner summary in with a private section's pages (the tabs, settings, statistics,
 * onboarding), once as the learner enters it: never in a prefetch or the static shell. The app's
 * frame draws the learner's goal, level, tabs, places and account from it in the server's HTML,
 * with the page, instead of once the page's code has loaded (`useFrameLearner`); a hard load's
 * first paint waits for it briefly (`HoldFirstPaint`), so a page whose content was read first
 * doesn't paint the frame without them. The meta tells the browser the summary is on its way, so
 * it doesn't read it again (`ensureLearnerSummary`); the frame and every other page share it in
 * the browser.
 */
export function LearnerSummarySeed() {
  const seed = readSeedOnNavigation();

  return (
    <>
      <meta content="" name={LEARNER_SEED_META} />
      <HoldFirstPaint id={SEED_END_ID} maxWaitMs={SEED_MAX_WAIT_MS} />
      <Suspense fallback={null}>
        <ProvideLearnerSeed seed={seed} />
        <SeedEnd seed={seed} />
      </Suspense>
    </>
  );
}
