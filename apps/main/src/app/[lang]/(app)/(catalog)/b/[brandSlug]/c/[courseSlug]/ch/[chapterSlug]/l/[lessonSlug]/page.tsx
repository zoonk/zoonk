import {
  CatalogNotFoundPage,
  getCatalogNotFoundMetadata,
} from "@/components/catalog/catalog-not-found";
import { getLessonStaticParams } from "@/data/catalog/catalog-static-params";
import { resolveLessonRoute } from "@/data/catalog/resolve-catalog-route";
import { permanentRedirect } from "@/i18n/navigation";
import { getPublicLibraryLesson } from "@zoonk/core/library/lessons/public";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { type Metadata } from "next";
import { getLibraryLessonMetadata } from "./library-lesson-metadata";
import { LibraryLessonPage } from "./library-lesson-page";

type Props = PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">;

/** Fully static like its course's page; the build writes the first lesson of those chapters. */
export const ensureStatic = "navigation";

/** No placeholder to paint first, like its course's page. */
export const instant = false;

export async function generateStaticParams({ params }: { params: { lang: string } }) {
  return getLessonStaticParams(params.lang);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, ...routeParams } = await params;
  const route = await resolveLessonRoute(routeParams);

  if (route.kind === "notFound") {
    return getCatalogNotFoundMetadata();
  }

  if (route.kind !== "library") {
    return {};
  }

  return getLibraryLessonMetadata({ locale: lang, params: routeParams, route });
}

/**
 * A lesson that no longer exists in a course that does moves permanently to
 * the course page, a real permanent redirect like the chapter page's.
 */
export default async function LessonPage({ params }: Props) {
  const { lang, ...routeParams } = await params;
  const locale = getSupportedLocaleFromLanguage(lang);
  const route = await resolveLessonRoute(routeParams);

  if (route.kind === "notFound") {
    return <CatalogNotFoundPage />;
  }

  if (route.kind === "redirect") {
    return permanentRedirect({ href: route.href, locale });
  }

  const lesson = await getPublicLibraryLesson({ lessonId: route.lesson.id });

  if (!lesson) {
    return <CatalogNotFoundPage />;
  }

  return <LibraryLessonPage lesson={lesson} locale={locale} params={routeParams} route={route} />;
}
