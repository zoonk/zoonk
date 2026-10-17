import { type BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { parseSetCookieHeader } from "better-auth/cookies";
import { NO_SESSION_HINT, SESSION_HINT, SESSION_HINT_COOKIE } from "../session-hint";

/**
 * Writes the session hint in exactly the responses that set or delete the session cookie (signing
 * in or up, a guest's sign-in, a sign-in token, a renewal, signing out, a session found gone), from
 * the session cookie the browser keeps last, with its lifetime and scope. Nothing else writes it,
 * so an old response can only take the hint back together with the session it held. A session read
 * that finds no session also drops a hint the browser kept without one (cleared session cookies).
 * Dropped, not `0`: an answer landing after another tab signed in leaves the hint saying nothing,
 * never that nobody is there. It runs after every other hook that can touch the session cookie and
 * before `nextCookies` hands the response's cookies to Next.js.
 */
const writeSessionHint = createAuthMiddleware(async (ctx) => {
  const cookies = parseSetCookieHeader(ctx.context.responseHeaders?.get("set-cookie") ?? "");
  const cookie = cookies.get(ctx.context.authCookies.sessionToken.name);

  if (!cookie) {
    const kept = ctx.getCookie(SESSION_HINT_COOKIE);

    if (
      ctx.path === "/get-session" &&
      ctx.context.returned === null &&
      kept &&
      kept !== NO_SESSION_HINT
    ) {
      const { domain, secure } = ctx.context.authCookies.sessionToken.attributes;

      ctx.setCookie(SESSION_HINT_COOKIE, "", {
        domain,
        maxAge: 0,
        path: "/",
        sameSite: "lax",
        secure,
      });
    }

    return;
  }

  const scope = {
    domain: cookie.domain,
    path: "/",
    sameSite: "lax",
    secure: cookie.secure,
  } as const;

  if (!cookie.value || cookie["max-age"] === 0) {
    ctx.setCookie(SESSION_HINT_COOKIE, NO_SESSION_HINT, scope);
    return;
  }

  ctx.setCookie(SESSION_HINT_COOKIE, SESSION_HINT, {
    ...scope,
    expires: cookie.expires,
    maxAge: cookie["max-age"],
  });
});

/** Main's session hint (`session-hint.ts`); keep it right before `nextCookies`. */
export function sessionHintPlugin() {
  return {
    hooks: { after: [{ handler: writeSessionHint, matcher: () => true }] },
    id: "session-hint",
  } satisfies BetterAuthPlugin;
}
