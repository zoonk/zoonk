import { type ServiceTier } from "@zoonk/ai/provider-options";
import { claimRunToken, startOnce, waitForRunToken } from "../_shared/run-token";
import { isUnusableOutput } from "../_shared/unusable-output";
import { type ResearchAnalytics } from "../research/_utils/research-analytics";
import { readReleasePage } from "../research/release-page";
import { findProductByIdStep } from "../research/steps/product-steps";
import { courseReleaseWorkflow } from "./course-release-workflow";
import {
  findNewestReleaseSearchStep,
  findUnreadReleasesPageStep,
  listCoursesBehindStep,
  readReleasesPageStep,
  recordReleasePageSearchedStep,
  recordUnreadableReleasesPageStep,
  saveProductReleasesStep,
} from "./steps/product-releases-steps";

type ReleasesRun = {
  analytics: ResearchAnalytics;
  productId: string;
  release: string | null;
  serviceTier: ServiceTier | undefined;
};

/** A page the model can't read is recorded and left until it changes. */
async function readUnreadPage({ analytics, productId, release, serviceTier }: ReleasesRun) {
  const page = await findUnreadReleasesPageStep(productId);

  if (!page) {
    return;
  }

  const reading = await readReleasesPageStep({ analytics, page, release, serviceTier }).catch(
    async (error: unknown) => {
      if (!isUnusableOutput(error)) {
        throw error;
      }

      await recordUnreadableReleasesPageStep(page);
      return null;
    },
  );

  if (reading) {
    await startCourseReleases(await saveProductReleasesStep(reading));
  }
}

/**
 * When no release is current (none dated, or none out yet), reads the newest listed one's page.
 * The lookup is recorded once it finishes; one that keeps failing in an outage throws and stays due.
 */
async function readNewestReleasePage({
  analytics,
  productId,
  serviceTier,
}: Omit<ReleasesRun, "release">) {
  const search = await findNewestReleaseSearchStep(productId);
  const known = search ? await findProductByIdStep(productId) : null;

  if (!search || !known) {
    return;
  }

  const { language, release, releaseId } = search;

  const link = await readReleasePage({ analytics, known, language, release, serviceTier }).catch(
    (error: unknown) => {
      if (!isUnusableOutput(error)) {
        throw error;
      }

      return null;
    },
  );

  await recordReleasePageSearchedStep(releaseId);

  if (link) {
    await startCourseReleases(await listCoursesBehindStep({ productId }));
  }
}

/** One run at a time per product; a run that finds another reading waits for it. */
async function underProductClaim(productId: string, work: () => Promise<void>): Promise<void> {
  const token = `product:${productId}`;
  using claim = await claimRunToken(token);

  if (claim.conflict) {
    await waitForRunToken(token);
  }

  await work();
}

/** Research's refresh of a stale product, before its goal is linked: the releases page alone. */
export function readUnreadReleasesPage(run: ReleasesRun): Promise<void> {
  return underProductClaim(run.productId, () => readUnreadPage(run));
}

/**
 * The freshness check, and research once its goal is linked, read a product's releases through
 * here: the releases page when it's unread, then the newest release's own page when none is
 * current. The main courses a new current release leaves behind start their update.
 */
export function readProductReleases(run: ReleasesRun): Promise<void> {
  return underProductClaim(run.productId, async () => {
    await readUnreadPage(run);
    await readNewestReleasePage(run);
  });
}

/** One release update per course at a time: a course already updating keeps its run. */
async function startCourseReleases(courseIds: readonly string[]): Promise<void> {
  await Promise.all(
    courseIds.map((courseId) =>
      startOnce(courseReleaseWorkflow, [{ courseId }], `course-release:${courseId}`),
    ),
  );
}

/**
 * Followed main courses, all of them or those among `courseIds`, behind their product's current
 * release start their update. Returns how many.
 */
export async function updateCoursesBehind(courseIds?: string[]): Promise<number> {
  const behind = await listCoursesBehindStep({ courseIds });
  await startCourseReleases(behind);

  return behind.length;
}
