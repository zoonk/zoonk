import { getBrowserLocale } from "@/i18n/locale";
import { auth } from "@zoonk/auth";
import { isValidLocale } from "@zoonk/utils/locale";
import { type NextRequest } from "next/server";
import { getCallbackHref, readRedirectToParam } from "../../_utils/auth-redirect";

const AUTH_PAGES = new Set(["login", "otp", "setup", "untrusted-origin"]);

function redirectTo(location: string): Response {
  return new Response(null, {
    headers: { "Cache-Control": "no-store", Location: location },
    status: 307,
  });
}

/**
 * The routing layer sends here what a prerendered page can't decide: a sign-in from a browser that
 * may already be signed in, and a visit that names no language. The language is picked the way auth
 * emails and the callback pick it, so every screen of a sign-in agrees.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/auth/open/[page]">) {
  const { page } = await params;
  const query = request.nextUrl.searchParams;

  if (!AUTH_PAGES.has(page)) {
    return new Response(null, { status: 404 });
  }

  // A revoked session can remain in the signed cookie cache after another app logs out. An expired
  // sign-in must show the form, or the callback would send the learner straight back.
  const isSignedIn =
    page === "login" &&
    !query.has("error") &&
    (await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } }));

  if (isSignedIn) {
    return redirectTo(getCallbackHref(readRedirectToParam(query)));
  }

  const requested = query.get("locale");
  const locale = requested && isValidLocale(requested) ? requested : await getBrowserLocale();

  return redirectTo(`/auth/${locale}/${page}${request.nextUrl.search}`);
}
