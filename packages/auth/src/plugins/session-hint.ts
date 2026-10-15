import { isJsonObject } from "@zoonk/utils/json";
import { type BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { parseSetCookieHeader } from "better-auth/cookies";
import { NO_SESSION_HINT, SESSION_HINT_COOKIE, SESSION_HINT_HEADER } from "../session-hint";
import { encodeSessionHintTag } from "../session-hint-tag";

type SessionCookie = NonNullable<ReturnType<ReturnType<typeof parseSetCookieHeader>["get"]>>;
type SessionOwner = { session: { token: string }; user: { id: string } } | null | undefined;

/** The session token in a signed session cookie's value (`token.signature`). */
function getCookieToken(cookie: SessionCookie): string {
  return cookie.value.slice(0, cookie.value.lastIndexOf("."));
}

/**
 * Whose session a written session cookie holds: the session this response made or renewed, or
 * the one it read and wrote again. Never the request's learner for a token that isn't theirs: a
 * session this response can't place leaves the hint saying nothing.
 */
function getCookieOwner({
  cookie,
  owners,
}: {
  cookie: SessionCookie;
  owners: SessionOwner[];
}): string | undefined {
  const token = getCookieToken(cookie);
  return owners.find((owner) => owner?.session.token === token)?.user.id;
}

/** Whom a session read answered with: their tag, or nobody's for no session. */
function getReturnedHint({ returned, secret }: { returned: unknown; secret: string }) {
  if (returned === null) {
    return NO_SESSION_HINT;
  }

  const user = isJsonObject(returned) ? returned.user : null;

  return isJsonObject(user) && typeof user.id === "string"
    ? encodeSessionHintTag({ secret, userId: user.id })
    : null;
}

/**
 * Writes the session hint in exactly the responses that set or delete the session cookie (signing
 * in or up, a guest's sign-in, a sign-in token, a renewal, signing out, a session found gone),
 * from the session cookie the browser keeps last, with its lifetime and scope. Nothing else
 * writes it, so an old response can only take the hint back together with the session it held.
 * Session reads also say whose session they found in a header, without writing anything.
 * It runs after every other hook that can touch the session cookie and before `nextCookies`
 * hands the response's cookies to Next.js.
 */
const writeSessionHint = createAuthMiddleware(async (ctx) => {
  const { secret } = ctx.context;
  const cookies = parseSetCookieHeader(ctx.context.responseHeaders?.get("set-cookie") ?? "");
  const cookie = cookies.get(ctx.context.authCookies.sessionToken.name);

  if (!cookie) {
    const hint =
      ctx.path === "/get-session" && getReturnedHint({ returned: ctx.context.returned, secret });

    if (hint) {
      ctx.setHeader(SESSION_HINT_HEADER, hint);
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
    ctx.setHeader(SESSION_HINT_HEADER, NO_SESSION_HINT);
    return;
  }

  const userId = getCookieOwner({ cookie, owners: [ctx.context.newSession, ctx.context.session] });

  if (!userId) {
    ctx.setCookie(SESSION_HINT_COOKIE, "", { ...scope, maxAge: 0 });
    return;
  }

  const tag = encodeSessionHintTag({ secret, userId });

  ctx.setCookie(SESSION_HINT_COOKIE, tag, {
    ...scope,
    expires: cookie.expires,
    maxAge: cookie["max-age"],
  });

  ctx.setHeader(SESSION_HINT_HEADER, tag);
});

/** Main's session hint (`session-hint.ts`); keep it right before `nextCookies`. */
export function sessionHintPlugin() {
  return {
    hooks: { after: [{ handler: writeSessionHint, matcher: () => true }] },
    id: "session-hint",
  } satisfies BetterAuthPlugin;
}
