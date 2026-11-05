import { isValidCategory } from "@zoonk/utils/categories";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { type NextRequest, NextResponse } from "next/server";

const CATEGORY_PATH = new RegExp(
  `^(?:/(?<locale>${SUPPORTED_LOCALES.join("|")}))?/courses/(?<category>[^/]+)(?<deeper>/[^/].*)?/?$`,
  "u",
);

const NOT_FOUND_PATH = "catalog-not-found";

/** Client navigations and prefetches carry the `RSC` header and show the in-app not-found page; only page loads need the status. */
function isPageLoad(request: NextRequest): boolean {
  return (request.method === "GET" || request.method === "HEAD") && !request.headers.has("rsc");
}

function getMissingCategoryLocale(pathname: string): string | null {
  const category = CATEGORY_PATH.exec(pathname)?.groups;

  if (!category?.category || (!category.deeper && isValidCategory(category.category))) {
    return null;
  }

  return category.locale ?? DEFAULT_LOCALE;
}

export function getCategoryNotFound({
  localized,
  request,
}: {
  localized: NextResponse;
  request: NextRequest;
}): NextResponse | null {
  if (!isPageLoad(request)) {
    return null;
  }

  const locale = getMissingCategoryLocale(request.nextUrl.pathname);

  if (!locale) {
    return null;
  }

  const headers = new Headers(localized.headers);
  headers.delete("x-middleware-next");

  return NextResponse.rewrite(new URL(`/${locale}/${NOT_FOUND_PATH}`, request.url), { headers });
}
