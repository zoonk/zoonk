import { listCoursesBehind } from "@zoonk/core/library/products/course-release";
import {
  type ReleasesReading,
  type UnreadReleasesPage,
  findUnreadReleasesPage,
  readReleasesPage,
  recordUnreadableReleasesPage,
  saveReadReleases,
} from "@zoonk/core/library/products/product-releases";

/** Null when the page's releases are read already. */
export async function findUnreadReleasesPageStep(
  productId: string,
): Promise<UnreadReleasesPage | null> {
  "use step";
  return findUnreadReleasesPage(productId);
}

export async function readReleasesPageStep(
  input: Parameters<typeof readReleasesPage>[0],
): Promise<ReleasesReading> {
  "use step";
  return readReleasesPage(input);
}

export async function recordUnreadableReleasesPageStep(page: UnreadReleasesPage): Promise<void> {
  "use step";
  await recordUnreadableReleasesPage(page);
}

/** Returns the product's followed main courses that are now behind. */
export async function saveProductReleasesStep(reading: ReleasesReading): Promise<string[]> {
  "use step";
  return saveReadReleases(reading);
}

/**
 * Followed main courses, all of them or those among `courseIds`, whose product has a newer release
 * than they teach, such as an announced one now out.
 */
export async function listCoursesBehindStep(courseIds?: string[]): Promise<string[]> {
  "use step";
  return listCoursesBehind({ courseIds });
}
