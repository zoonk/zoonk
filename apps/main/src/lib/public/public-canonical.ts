import "server-only";
import { getCourseHref } from "@/data/courses/course-href";
import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { getChapterHomeRoute, getLessonHomeRoute } from "@zoonk/core/library/routes/home";
import { getChapterHref, getLessonHref } from "./public-hrefs";

type CourseParams = { brandSlug: string; courseSlug: string; language: string };
type ChapterParams = CourseParams & { chapterSlug: string };

export function getCourseUrl({ brandSlug, courseSlug, language }: CourseParams): string {
  return getLocalizedUrl({ href: getCourseHref({ brandSlug, courseSlug }), language });
}

/**
 * A shared chapter can sit in several courses. Its canonical URL is its home
 * placement, so search engines see one page per chapter; other placements
 * point there.
 */
export async function getChapterUrls({
  chapterId,
  ...params
}: ChapterParams & { chapterId: string }) {
  const home = await getChapterHomeRoute({ chapterId });
  const current = getLocalizedUrl({ href: getChapterHref(params), language: params.language });

  return {
    canonical: home
      ? getLocalizedUrl({ href: getChapterHref(home), language: home.language })
      : current,
    course: getCourseUrl(params),
    current,
  };
}

/** Like chapters, a reused lesson's canonical URL is its home chapter's placement. */
export async function getLessonUrls({
  lessonId,
  ...params
}: ChapterParams & { lessonId: string; lessonSlug: string }) {
  const home = await getLessonHomeRoute({ lessonId });
  const current = getLocalizedUrl({ href: getLessonHref(params), language: params.language });

  return {
    canonical: home
      ? getLocalizedUrl({ href: getLessonHref(home), language: home.language })
      : current,
    chapter: getLocalizedUrl({ href: getChapterHref(params), language: params.language }),
    course: getCourseUrl(params),
    current,
  };
}
