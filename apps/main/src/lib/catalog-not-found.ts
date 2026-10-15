import { decodeRouteParam } from "@zoonk/core/navigation/decode-route-param";
import { isValidCategory } from "@zoonk/utils/categories";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { type NextRequest, NextResponse } from "next/server";

const LOCALE_PREFIX = `(?:/(?<locale>${SUPPORTED_LOCALES.join("|")}))?`;

/** A course, chapter or lesson page: they all need their course. */
const COURSE_PATH = new RegExp(
  `^${LOCALE_PREFIX}/b/(?<brandSlug>[^/]+)/c/(?<courseSlug>[^/]+)(?:/|$)`,
  "u",
);

/** A category's page, or any path under one, where no page exists (such as an old course link). */
const CATEGORY_PATH = new RegExp(
  `^${LOCALE_PREFIX}/courses/(?<category>[^/]+)(?<deeper>/[^/].*)?/?$`,
  "u",
);

/**
 * The catalog's always-404 page (`(catalog)/catalog-not-found`): a real 404 status, with the
 * catalog's not-found message inside the app's frame.
 */
const NOT_FOUND_PATH = "catalog-not-found";

/**
 * Client navigations and prefetches carry the `RSC` header; they show the in-app not-found page,
 * so only page loads (people arriving from a link, and search engines) need the status.
 */
function isPageLoad(request: NextRequest): boolean {
  return (request.method === "GET" || request.method === "HEAD") && !request.headers.has("rsc");
}

/**
 * Whether a public course URL names a course. Read here, in the proxy, because the course page
 * streams its App Shell before it knows: one indexed lookup, and only for page loads of course
 * URLs, so the proxy stays free of database reads everywhere else.
 */
async function hasCourse({
  brandSlug,
  courseSlug,
}: {
  brandSlug: string;
  courseSlug: string;
}): Promise<boolean> {
  const { getCourseRouteWhere, prisma } = await import("@zoonk/db");

  const course = await prisma.course.findFirst({
    select: { id: true },
    where: getCourseRouteWhere({
      brandSlug: decodeRouteParam(brandSlug),
      courseSlug: decodeRouteParam(courseSlug),
    }),
  });

  return course !== null;
}

/** The locale of a missing catalog page, or null when the page exists or isn't a catalog page. */
async function getMissingCatalogLocale(pathname: string): Promise<string | null> {
  const category = CATEGORY_PATH.exec(pathname)?.groups;

  if (category?.category) {
    const exists = !category.deeper && isValidCategory(category.category);
    return exists ? null : (category.locale ?? DEFAULT_LOCALE);
  }

  const course = COURSE_PATH.exec(pathname)?.groups;

  if (!course?.brandSlug || !course.courseSlug) {
    return null;
  }

  const exists = await hasCourse({ brandSlug: course.brandSlug, courseSlug: course.courseSlug });
  return exists ? null : (course.locale ?? DEFAULT_LOCALE);
}

/**
 * Answers a page load of a course, chapter or lesson URL whose course doesn't exist, or of a
 * category that doesn't exist (or a path under one), with a real 404 inside the catalog instead of
 * a page that only says so: those pages stream before they know. It keeps `localized`'s headers
 * (the visitor's language and cookie), so the 404 page speaks the visitor's language. Null when
 * the page exists.
 */
export async function getCatalogNotFound({
  localized,
  request,
}: {
  localized: NextResponse;
  request: NextRequest;
}): Promise<NextResponse | null> {
  if (!isPageLoad(request)) {
    return null;
  }

  const locale = await getMissingCatalogLocale(request.nextUrl.pathname);

  if (!locale) {
    return null;
  }

  const headers = new Headers(localized.headers);
  headers.delete("x-middleware-next");

  return NextResponse.rewrite(new URL(`/${locale}/${NOT_FOUND_PATH}`, request.url), { headers });
}
