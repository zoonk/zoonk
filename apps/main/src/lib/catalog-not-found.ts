import { decodeRouteParam } from "@zoonk/core/navigation/decode-route-param";
import { isValidCategory } from "@zoonk/utils/categories";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { type NextRequest, NextResponse } from "next/server";

const LOCALE_PREFIX = `(?:/(?<locale>${SUPPORTED_LOCALES.join("|")}))?`;

const COURSE_PATH = new RegExp(
  `^${LOCALE_PREFIX}/b/(?<brandSlug>[^/]+)/c/(?<courseSlug>[^/]+)(?:/|$)`,
  "u",
);

const CATEGORY_PATH = new RegExp(
  `^${LOCALE_PREFIX}/courses/(?<category>[^/]+)(?<deeper>/[^/].*)?/?$`,
  "u",
);

const NOT_FOUND_PATH = "catalog-not-found";

/** Client navigations and prefetches carry the `RSC` header and show the in-app not-found page; only page loads need the status. */
function isPageLoad(request: NextRequest): boolean {
  return (request.method === "GET" || request.method === "HEAD") && !request.headers.has("rsc");
}

/** In the proxy because the course page streams its App Shell before it knows; only course page loads read it. */
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
