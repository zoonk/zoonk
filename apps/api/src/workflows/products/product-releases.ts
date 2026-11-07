import { type ServiceTier } from "@zoonk/ai/provider-options";
import { claimRunToken, startOnce, waitForRunToken } from "../_shared/run-token";
import { isUnusableOutput } from "../_shared/unusable-output";
import { type ResearchAnalytics } from "../research/_utils/research-analytics";
import { readReleasePage } from "../research/release-page";
import { findProductByIdStep } from "../research/steps/product-steps";
import { courseReleaseWorkflow } from "./course-release-workflow";
import {
  claimNewestReleaseSearchStep,
  findUnreadReleasesPageStep,
  listCoursesBehindStep,
  readReleasesPageStep,
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

/** When no release is current (none dated, or none out yet), reads the newest listed one's page. */
async function readNewestReleasePage({
  analytics,
  productId,
  serviceTier,
}: Omit<ReleasesRun, "release">) {
  const search = await claimNewestReleaseSearchStep(productId);
  const known = search ? await findProductByIdStep(productId) : null;

  if (!search || !known) {
    return;
  }

  const link = await readReleasePage({ analytics, known, ...search, serviceTier });

  if (link) {
    await startCourseReleases(await listCoursesBehindStep({ productId }));
  }
}

/**
 * Research's refresh of a stale product, a new product's research and the freshness check read a
 * product's releases through here, one run at a time; a run that finds another reading waits for
 * it and reads only what it left unread. The main courses a new current release leaves behind
 * start their update.
 */
export async function readProductReleases(run: ReleasesRun): Promise<void> {
  const token = `product:${run.productId}`;
  using claim = await claimRunToken(token);

  if (claim.conflict) {
    await waitForRunToken(token);
  }

  await readUnreadPage(run);
  await readNewestReleasePage(run);
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
