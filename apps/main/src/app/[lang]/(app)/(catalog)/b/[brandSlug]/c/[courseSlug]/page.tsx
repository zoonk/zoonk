import {
  CatalogNotFound,
  getCatalogNotFoundMetadata,
} from "@/components/catalog/catalog-not-found";
import { NotFoundPage } from "@/components/errors/not-found-page";
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
 * The same for everyone; the learner's own bits are read in the browser. Written whole before it's
 * served, so a missing course answers a real 404.
 */
export const ensureStatic = "navigation";

/** The page reads its address outside any boundary, so it has no placeholder to paint first. */
export const instant = false;

export async function generateStaticParams({ params }: { params: { lang: string } }) {
  return getCourseStaticParams(params.lang);
}

/** Editions in other languages have their own slugs, so each is listed as an explicit alternate. */
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
    description: course.description
      ? t(
          "{description} An online course in short lessons, with a study plan for each day that starts from what you already know. Start free.",
          { description: course.description },
        )
      : t(
          "Learn {course} online in short lessons, with a study plan for each day that starts from what you already know. Start free.",
          { course: course.title },
        ),
    robots: { follow: true, index: route.isListed && contentLocale === locale },
    title:
      course.format === "exam"
        ? t({
            description:
              "A search result's title for an exam's page. {course} is the exam's name, such as “SAT” or “ENEM”. Use the words people in your country type when they look for help studying for an exam.",
            message: "{course} prep: study plan and lessons",
            values: { course: course.title },
          })
        : t({
            description:
              "A search result's title for a course's page. {course} is the course's name. Use the words people in your country type when they look for a course on the internet.",
            message: "Learn {course}: online course",
            values: { course: course.title },
          }),
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
    return (
      <NotFoundPage>
        <CatalogNotFound />
      </NotFoundPage>
    );
  }

  return (
    <LibraryCoursePage
      locale={getSupportedLocaleFromLanguage(lang)}
      params={routeParams}
      route={route}
    />
  );
}
