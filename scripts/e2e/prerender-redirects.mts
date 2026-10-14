const TEMPORARY_REDIRECT_STATUS = 307;

/** These delivery redirects render no page; their destinations are checked without following them. */
export function isExpectedPrerenderRedirect({
  baseURL,
  blogURL,
  locale,
  location,
  path,
  persona,
  status,
}: {
  baseURL: string;
  blogURL: string;
  locale: string;
  location: string | undefined;
  path: string;
  persona: string;
  status: number;
}) {
  if (status !== TEMPORARY_REDIRECT_STATUS || !location) {
    return false;
  }

  const destination = new URL(location, baseURL).href;

  if (path === `/${locale}/blog`) {
    return destination === new URL(blogURL).href;
  }

  return (
    persona === "learner" &&
    path === `/${locale}` &&
    destination === new URL(`/${locale}/today`, baseURL).href
  );
}

function isVerifiedBlogReceipt({
  baseURL,
  blogURL,
  persona,
  value,
}: {
  baseURL: string;
  blogURL: string;
  persona: string;
  value: unknown;
}) {
  if (
    typeof value !== "object" ||
    value === null ||
    !("locale" in value) ||
    typeof value.locale !== "string" ||
    !("location" in value) ||
    typeof value.location !== "string" ||
    !("path" in value) ||
    typeof value.path !== "string" ||
    !("persona" in value) ||
    value.persona !== persona ||
    !("status" in value) ||
    typeof value.status !== "number" ||
    value.path !== `/${value.locale}/blog`
  ) {
    return false;
  }

  return isExpectedPrerenderRedirect({
    baseURL,
    blogURL,
    locale: value.locale,
    location: value.location,
    path: value.path,
    persona,
    status: value.status,
  });
}

/** A no-shell diagnostic is expected only when BOTH local blog GETs proved the exact redirect. */
export function hasVerifiedBlogRedirects({
  baseURL,
  blogURL,
  result,
}: {
  baseURL: string;
  blogURL: string;
  result: unknown;
}) {
  if (
    typeof result !== "object" ||
    result === null ||
    !("results" in result) ||
    !Array.isArray(result.results)
  ) {
    return false;
  }

  const values: readonly unknown[] = result.results;

  function hasReceipt(persona: string) {
    return values.some((value) => isVerifiedBlogReceipt({ baseURL, blogURL, persona, value }));
  }

  return hasReceipt("visitor") && hasReceipt("learner");
}
