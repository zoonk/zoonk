import {
  CatalogNotFoundPage,
  getCatalogNotFoundMetadata,
} from "@/components/catalog/catalog-not-found";
import { getCourseStaticParams } from "@/data/catalog/catalog-static-params";
import { type LibraryCourseRoute, resolveCourseRoute } from "@/data/catalog/resolve-catalog-route";
import { getCourseUrl } from "@/lib/public/public-canonical";
import { listPublishedCourseEditions } from "@zoonk/core/courses/published-editions";
import { getContentLocale, getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { LibraryCoursePage } from "./library-course-page";

type Props = PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]">;

/**
 * The same for everyone and fully static: the build writes the most popular courses' pages, any
 * other is written on its first request, and each is kept until its content's tags expire it or the
 * catalog's lifetime ends. The learner's own bits are read in the browser.
 */
export const ensureStatic = "navigation";

/**
 * The page reads its address outside any boundary, so it has no placeholder to paint first: its
 * words are in the page from the first paint. The catalog's links to it prefetch it whole, and a
 * navigation that wasn't prefetched waits for the static page.
 */
export const instant = false;

export async function generateStaticParams({ params }: { params: { lang: string } }) {
  return getCourseStaticParams(params.lang);
}

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

  const t = await getExtracted({ locale: contentLocale ?? locale });
  const languages = await getEditionAlternates(course.id);

  return {
    alternates: { canonical: getCourseUrl({ ...params, language: course.language }), languages },
    description: t(
      "Learn {course} in short lessons, with a plan that starts at your level and fits your schedule. Start free. {description}",
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
    return getCatalogNotFoundMetadata();
  }

  return getLibraryCourseMetadata({ locale: lang, params: routeParams, route });
}

export default async function CoursePage({ params }: Props) {
  const { lang, ...routeParams } = await params;
  const route = await resolveCourseRoute(routeParams);

  if (route.kind === "notFound") {
    return <CatalogNotFoundPage />;
  }

  return (
    <LibraryCoursePage
      locale={getSupportedLocaleFromLanguage(lang)}
      params={routeParams}
      route={route}
    />
  );
}
