import { type ServiceTier } from "@zoonk/ai/provider-options";
import { claimRunToken, startOnce, waitForRunToken } from "../_shared/run-token";
import { isUnusableOutput } from "../_shared/unusable-output";
import { type ResearchAnalytics } from "../research/_utils/research-analytics";
import { courseReleaseWorkflow } from "./course-release-workflow";
import {
  findUnreadReleasesPageStep,
  listCoursesBehindStep,
  readReleasesPageStep,
  recordUnreadableReleasesPageStep,
  saveProductReleasesStep,
} from "./steps/product-releases-steps";

/**
 * Research's refresh of a stale product and the freshness check read a product's releases page
 * through here, one run at a time; a run that finds another reading waits for it and reads only
 * what it left unread. A page the model can't read is recorded and left until it changes. The main
 * courses a new current release leaves behind start their update.
 */
export async function readProductReleases({
  analytics,
  productId,
  release,
  serviceTier,
}: {
  analytics: ResearchAnalytics;
  productId: string;
  release: string | null;
  serviceTier: ServiceTier | undefined;
}): Promise<void> {
  const token = `product:${productId}`;
  using claim = await claimRunToken(token);

  if (claim.conflict) {
    await waitForRunToken(token);
  }

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

  if (!reading) {
    return;
  }

  const courseIds = await saveProductReleasesStep(reading);
  await startCourseReleases(courseIds);
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
  const behind = await listCoursesBehindStep(courseIds);
  await startCourseReleases(behind);

  return behind.length;
}
