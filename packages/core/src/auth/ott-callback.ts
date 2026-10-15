import "server-only";
import { auth } from "@zoonk/auth";
import { type NextRequest } from "next/server";
import { getSafeAppRelativePath } from "./ott-redirect";
import { ONE_TIME_TOKEN_LOGIN_STATE_COOKIE } from "./ott-state";

const AUTH_SUCCESS_REDIRECT = "/";
const CONTINUE_FORM_ID = "ott-continue";

/** HTML delivery of the callback's pages: translated text and destinations are escaped. */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Expires the state cookie after every callback attempt so a login initiation
 * can only authorize one callback navigation.
 */
function getExpiredLoginStateCookie(): string {
  return `${ONE_TIME_TOKEN_LOGIN_STATE_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

/**
 * Builds the redirect response used by callback routes so success and failure
 * paths return the same minimal 303 shape in every app that consumes this
 * helper: the callback's POST goes on to a page the browser reads with a GET.
 */
function redirectTo(location: string): Response {
  const headers = new Headers({ Location: location, "Referrer-Policy": "no-referrer" });
  headers.append("set-cookie", getExpiredLoginStateCookie());

  return new Response(null, { headers, status: 303 });
}

/**
 * Returns the post-login destination requested by the app login page. Only
 * app-relative paths are allowed here so a valid one-time token cannot become
 * an open redirect to another origin.
 */
function getSafeNextPath(request: NextRequest): string | null {
  return getSafeAppRelativePath(request.nextUrl.searchParams.get("next"));
}

/**
 * A sign-in that couldn't finish goes back to the app's login, which says so and starts again for
 * the same page.
 */
function getAuthErrorRedirect(request: NextRequest): string {
  const params = new URLSearchParams({ error: "auth" });
  const nextPath = getSafeNextPath(request);

  if (nextPath) {
    params.set("next", nextPath);
  }

  return `/login?${params.toString()}`;
}

/** Only one automatic retry; the owning app renders the terminal 401 as a retry screen. */
function authFailure(request: NextRequest): Response {
  if (request.nextUrl.searchParams.get("error") !== "auth") {
    return redirectTo(getAuthErrorRedirect(request));
  }

  return new Response(null, {
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "set-cookie": getExpiredLoginStateCookie(),
    },
    status: 401,
  });
}

/**
 * Checks the callback state before the one-time token is redeemed so attacker
 * tokens cannot force a browser into an attacker-controlled session.
 */
function isValidLoginState({
  request,
  state,
}: {
  request: NextRequest;
  state: string | null;
}): boolean {
  if (!state) {
    return false;
  }

  return request.cookies.get(ONE_TIME_TOKEN_LOGIN_STATE_COOKIE)?.value === state;
}

/** A minimal HTML page for the callback, which loads nothing else. */
function htmlPage({ body, lang, title }: { body: string; lang: string; title: string }) {
  return `<!doctype html><html lang="${escapeHtml(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head><body><main><h1>${escapeHtml(title)}</h1>${body}</main></body></html>`;
}

/**
 * The callback's GET, what following the sign-in link opens: a page that posts itself back to
 * the same address right away, with a button for a browser that doesn't run its script. Opening
 * the link writes nothing and spends nothing, so a mail scanner or a prefetch that only fetches
 * can't use up the one-time token; the POST redeems it. One that runs the page's script while
 * holding this browser's sign-in state would still post it. The form posts to the page's own
 * address, so the token never appears in the page, and no page after it learns the address
 * (`no-referrer`). Posted before the page finishes loading, the form replaces this entry in the
 * browser's history, so going back doesn't post a used token again. The script hides the button
 * as it posts, so a tap can't post the token a second time; a link outside the form starts a
 * fresh sign-in (a new token) for a post that never finished, such as one the learner stopped.
 */
export function getOneTimeTokenCallbackPage({
  copy,
  request,
  restartHref,
}: {
  copy: { action: string; lang: string; restart: string; title: string };
  request: NextRequest;
  /** The app's sign-in for the same page, which asks central auth for a new token. */
  restartHref: string;
}): Response {
  if (!request.nextUrl.searchParams.get("token")) {
    return authFailure(request);
  }

  const body = `<form id="${CONTINUE_FORM_ID}" method="post"><button type="submit">${escapeHtml(copy.action)}</button></form><p><a href="${escapeHtml(restartHref)}">${escapeHtml(copy.restart)}</a></p><script>{const f=document.getElementById(${JSON.stringify(CONTINUE_FORM_ID)});f.hidden=true;f.submit()}</script>`;

  return new Response(htmlPage({ body, lang: copy.lang, title: copy.title }), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
    },
    status: 200,
  });
}

/**
 * The page for a sign-in the callback couldn't finish twice (its 401 from
 * `verifyOneTimeTokenCallback`), with a way to start again; the failed answer's cookies stay.
 */
export function getOneTimeTokenFailurePage({
  copy,
  href,
  response,
}: {
  copy: { lang: string; retry: string; title: string };
  href: string;
  response: Response;
}): Response {
  const body = `<a href="${escapeHtml(href)}">${escapeHtml(copy.retry)}</a>`;
  const headers = new Headers(response.headers);

  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Referrer-Policy", "no-referrer");

  return new Response(htmlPage({ body, lang: copy.lang, title: copy.title }), {
    headers,
    status: response.status,
  });
}

/**
 * The callback's POST, sent by its GET page: keeps cross-app one-time-token callbacks consistent
 * across apps that receive a Better Auth session handoff. The token is read from the query string
 * so the callback URL stays stable while the state cookie blocks login CSRF.
 */
export async function verifyOneTimeTokenCallback(request: NextRequest): Promise<Response> {
  const state = request.nextUrl.searchParams.get("state");
  const token = request.nextUrl.searchParams.get("token");

  if (!token || !isValidLoginState({ request, state })) {
    return authFailure(request);
  }

  const response = await auth.api.verifyOneTimeToken({
    asResponse: true,
    body: { token },
    headers: request.headers,
  });

  if (!response.ok) {
    return authFailure(request);
  }

  const headers = new Headers({
    Location: getSafeNextPath(request) ?? AUTH_SUCCESS_REDIRECT,
    "Referrer-Policy": "no-referrer",
  });

  headers.append("set-cookie", getExpiredLoginStateCookie());

  for (const cookie of response.headers.getSetCookie()) {
    headers.append("set-cookie", cookie);
  }

  return new Response(null, { headers, status: 303 });
}
