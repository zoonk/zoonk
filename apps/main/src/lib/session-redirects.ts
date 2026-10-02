import { ACCOUNT_MARKER_COOKIE, getSessionCookieName } from "@zoonk/auth/cookies";
import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { type NextRequest } from "next/server";

/** Who a request comes from, as far as its cookies tell. */
type Visitor = { hasAccount: boolean; hasSession: boolean };

/**
 * Pages that exist twice: a static page for visitors, and the app's page for people it applies to.
 * The home page's app version is Today, for learners with an account; guests (who started a goal
 * or a lesson without one) keep the home page, which offers to continue where they left off.
 * Pricing's is the subscription page, for anyone with a session, where they subscribe or manage
 * Plus.
 */
const SESSION_REDIRECTS: { applies: (visitor: Visitor) => boolean; from: string; to: string }[] = [
  { applies: (visitor) => visitor.hasSession && visitor.hasAccount, from: "/", to: "/today" },
  { applies: (visitor) => visitor.hasSession, from: "/pricing", to: "/subscription" },
  { applies: (visitor) => !visitor.hasSession, from: "/subscription", to: "/pricing" },
];

const SESSION_COOKIE_NAMES = [
  getSessionCookieName({ secure: true }),
  getSessionCookieName({ secure: false }),
];

const LOCALIZED_PATH = new RegExp(
  `^(?:/(?<locale>${SUPPORTED_LOCALES.join("|")}))?(?<path>/.*)?$`,
  "u",
);

/** Splits `/pt/pricing/` into its locale and the page's path without a trailing slash. */
function parsePathname(pathname: string) {
  const groups = LOCALIZED_PATH.exec(pathname)?.groups;
  const path = groups?.path?.replace(/(?<=.)\/$/u, "") ?? "/";

  return { locale: groups?.locale, path };
}

/**
 * Sends each person to their version of a page before it renders, keeping the language and the
 * query. Only cookies are checked, so the proxy stays free of database reads: the session cookie,
 * and the marker auth keeps while that session is an account's. Both directions read the same
 * cookies, so nobody bounces between versions. The app's pages handle a cookie whose session has
 * expired on their own.
 */
export function getSessionRedirect(request: NextRequest): URL | null {
  const { locale, path } = parsePathname(request.nextUrl.pathname);

  const visitor: Visitor = {
    hasAccount: request.cookies.has(ACCOUNT_MARKER_COOKIE),
    hasSession: SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name)),
  };

  const redirect = SESSION_REDIRECTS.find((item) => item.from === path && item.applies(visitor));

  if (!redirect) {
    return null;
  }

  const url = new URL(locale ? `/${locale}${redirect.to}` : redirect.to, request.url);
  url.search = request.nextUrl.search;

  return url;
}
