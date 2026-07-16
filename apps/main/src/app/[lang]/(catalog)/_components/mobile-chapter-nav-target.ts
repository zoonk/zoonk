export type MobileChapterNavTarget = { courseHref: `/b/${string}/c/${string}` };

const CHAPTER_PAGE_PATH_PATTERN = /^\/b\/(?<brandSlug>[^/]+)\/c\/(?<courseSlug>[^/]+)\/ch\/[^/]+$/u;

/**
 * Chapter pages need route-specific mobile chrome, but the catalog layout sits
 * above the dynamic route params. Deriving the parent course URL from the
 * client pathname keeps that one navigation rule centralized without reshaping
 * the route tree or fetching chapter data in the shared layout.
 */
export function getMobileChapterNavTarget(pathname: string): MobileChapterNavTarget | null {
  const groups = CHAPTER_PAGE_PATH_PATTERN.exec(pathname)?.groups;

  if (!groups?.brandSlug || !groups.courseSlug) {
    return null;
  }

  return { courseHref: `/b/${groups.brandSlug}/c/${groups.courseSlug}` as const };
}
