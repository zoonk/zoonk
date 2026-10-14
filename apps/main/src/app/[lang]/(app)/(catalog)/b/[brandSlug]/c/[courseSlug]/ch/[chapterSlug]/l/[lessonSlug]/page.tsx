import { CatalogPageSkeleton } from "@/components/catalog/catalog-page-skeleton";
import { getLessonStaticParams } from "@/data/catalog/catalog-static-params";
import { resolveLessonRoute } from "@/data/catalog/resolve-catalog-route";
import { permanentRedirect } from "@/i18n/navigation";
import { getPublicLibraryLesson } from "@zoonk/core/library/lessons/public";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLibraryLessonMetadata } from "./library-lesson-metadata";
import { LibraryLessonPage } from "./library-lesson-page";

type Props = PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">;

/** Fully static like its course's page; the build writes the first lesson of those chapters. */
export const ensureStatic = "navigation";

export async function generateStaticParams({ params }: { params: { lang: string } }) {
  return getLessonStaticParams(params.lang);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, ...routeParams } = await params;
  const route = await resolveLessonRoute(routeParams);

  if (route.kind !== "library") {
    return {};
  }

  return getLibraryLessonMetadata({ locale: lang, params: routeParams, route });
}

/**
 * A lesson that no longer exists in a course that does moves permanently to
 * the course page (an instant meta refresh in the stream, like the chapter
 * page).
 */
async function LessonRoutePage({ params }: Pick<Props, "params">) {
  const { lang, ...routeParams } = await params;
  const locale = getSupportedLocaleFromLanguage(lang);
  const route = await resolveLessonRoute(routeParams);

  if (route.kind === "notFound") {
    notFound();
  }

  if (route.kind === "redirect") {
    return permanentRedirect({ href: route.href, locale });
  }

  const lesson = await getPublicLibraryLesson({ lessonId: route.lesson.id });

  if (!lesson) {
    notFound();
  }

  return <LibraryLessonPage lesson={lesson} locale={locale} params={routeParams} route={route} />;
}

export default function LessonPage({ params }: Props) {
  return (
    <Suspense fallback={<CatalogPageSkeleton kind="lesson" />}>
      <LessonRoutePage params={params} />
    </Suspense>
  );
}
