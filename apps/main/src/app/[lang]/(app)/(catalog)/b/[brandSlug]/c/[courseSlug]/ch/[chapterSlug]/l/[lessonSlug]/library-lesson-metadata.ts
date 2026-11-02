import "server-only";
import { getCatalogNotFoundMetadata } from "@/components/catalog/catalog-not-found";
import { type LibraryLessonRoute } from "@/data/catalog/resolve-catalog-route";
import { getLessonUrls } from "@/lib/public/public-canonical";
import { getPublicLibraryLesson } from "@zoonk/core/library/lessons/public";
import { getContentLocale } from "@zoonk/utils/locale";
import { type Metadata } from "next";

/** Only the course's language is indexed, once the catalog lists it; a reused lesson's canonical URL is its home placement. */
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
    return getCatalogNotFoundMetadata();
  }

  return {
    alternates: { canonical: urls.canonical },
    description: lesson.description,
    robots: {
      follow: true,
      index: route.isListed && getContentLocale(route.course.language) === locale,
    },
    title: lesson.title,
  };
}
