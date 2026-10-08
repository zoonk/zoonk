import { PublicPageSkeleton } from "@/components/public/public-page";
import { type LibraryCourseRoute, resolveCourseRoute } from "@/data/catalog/resolve-catalog-route";
import { getCourseUrl } from "@/lib/public/public-canonical";
import { listPublishedCourseEditions } from "@zoonk/core/courses/published-editions";
import { getContentLocale, getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LibraryCoursePage } from "./library-course-page";

type Props = PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]">;

/**
 * Editions in other languages have their own slugs, so each one is listed as
 * an explicit language alternate of the others.
 */
async function getEditionAlternates(courseId: string): Promise<Record<string, string>> {
  const editions = await listPublishedCourseEditions({ courseId });

  return Object.fromEntries(
    editions.map((edition) => [
      getSupportedLocaleFromLanguage(edition.language),
      getCourseUrl(edition),
    ]),
  );
}

async function getLibraryCourseMetadata({
  locale,
  params,
  route,
}: {
  locale: string;
  params: { brandSlug: string; courseSlug: string };
  route: LibraryCourseRoute;
}): Promise<Metadata> {
  const { course } = route;
  const contentLocale = getContentLocale(course.language);

  const [t, languages] = await Promise.all([
    getExtracted({ locale: contentLocale ?? locale }),
    getEditionAlternates(course.id),
  ]);

  return {
    alternates: { canonical: getCourseUrl({ ...params, language: course.language }), languages },
    description: t(
      "Learn {course} online with practical examples and everyday language. {description}",
      { course: course.title, description: course.description ?? "" },
    ),
    robots: { follow: true, index: route.isListed && contentLocale === locale },
    title: t("Learn {course}", { course: course.title }),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, ...routeParams } = await params;
  const route = await resolveCourseRoute(routeParams);

  if (route.kind === "notFound") {
    return {};
  }

  return getLibraryCourseMetadata({ locale: lang, params: routeParams, route });
}

async function CourseRoutePage({ params }: Pick<Props, "params">) {
  const { lang, ...routeParams } = await params;
  const route = await resolveCourseRoute(routeParams);

  if (route.kind === "notFound") {
    notFound();
  }

  return (
    <LibraryCoursePage
      locale={getSupportedLocaleFromLanguage(lang)}
      params={routeParams}
      route={route}
    />
  );
}

export default function CoursePage({ params }: Props) {
  return (
    <Suspense fallback={<PublicPageSkeleton />}>
      <CourseRoutePage params={params} />
    </Suspense>
  );
}
