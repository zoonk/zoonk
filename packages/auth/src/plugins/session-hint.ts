import { type BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { parseSetCookieHeader } from "better-auth/cookies";
import { NO_SESSION_HINT, SESSION_HINT, SESSION_HINT_COOKIE } from "../session-hint";

/**
 * A session read that finds no session drops the hint instead of writing `0`, since its answer may
 * land after another tab signed in.
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

export function sessionHintPlugin() {
  return {
    hooks: { after: [{ handler: writeSessionHint, matcher: () => true }] },
    id: "session-hint",
  } satisfies BetterAuthPlugin;
}
