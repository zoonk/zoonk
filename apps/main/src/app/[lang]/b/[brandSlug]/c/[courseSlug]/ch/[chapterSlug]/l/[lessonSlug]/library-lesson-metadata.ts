import "server-only";
import { type LibraryLessonRoute } from "@/data/catalog/resolve-catalog-route";
import { getLessonUrls } from "@/lib/public/public-canonical";
import { getPublicLibraryLesson } from "@zoonk/core/library/lessons/public";
import { getContentLocale } from "@zoonk/utils/locale";
import { type Metadata } from "next";

/**
 * Lesson titles and one-liners are written in the course's language. Only the
 * page in that language is indexed, and a reused lesson's canonical URL is its
 * home placement.
 */
export async function getLibraryLessonMetadata({
  locale,
  params,
  route,
}: {
  locale: string;
  params: { brandSlug: string; courseSlug: string };
  route: LibraryLessonRoute;
}): Promise<Metadata> {
  const [lesson, urls] = await Promise.all([
    getPublicLibraryLesson({ lessonId: route.lesson.id }),
    getLessonUrls({
      ...params,
      chapterSlug: route.chapter.slug,
      language: route.course.language,
      lessonId: route.lesson.id,
      lessonSlug: route.lesson.slug,
    }),
  ]);

  if (!lesson) {
    return {};
  }

  return {
    alternates: { canonical: urls.canonical },
    description: lesson.description,
    robots: { follow: true, index: getContentLocale(route.course.language) === locale },
    title: lesson.title,
  };
}
