import { type ServiceTier } from "@zoonk/ai/provider-options";
import { claimRunToken, startOnce, waitForRunToken } from "../_shared/run-token";
import { type ResearchAnalytics } from "../research/_utils/research-analytics";
import { courseReleaseWorkflow } from "./course-release-workflow";
import { readProductReleasesStep, saveProductReleasesStep } from "./steps/product-releases-steps";

/**
 * Research's refresh of a stale product and the freshness check read a product's releases page
 * through here, one run at a time; a run that finds another reading waits for it and reads only
 * what it left unread. The main courses a new current release leaves behind start their update.
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

  const reading = await readProductReleasesStep({ analytics, productId, release, serviceTier });

  if (!reading) {
    return;
  }

  const courseIds = await saveProductReleasesStep(reading);
  await startCourseReleases(courseIds);
}

/** One release update per course at a time: a course already updating keeps its run. */
export async function startCourseReleases(courseIds: readonly string[]): Promise<void> {
  await Promise.all(
    courseIds.map((courseId) =>
      startOnce(courseReleaseWorkflow, [{ courseId }], `course-release:${courseId}`),
    ),
  );
}
