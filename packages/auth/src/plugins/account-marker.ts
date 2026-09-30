import { type BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { parseSetCookieHeader } from "better-auth/cookies";
import { ACCOUNT_MARKER_COOKIE } from "../cookies";
import { type SessionUser, getAccountMarkerChange } from "./_utils/account-marker-change";

/** The user of a session Better Auth returned or started, as far as the marker cares. */
function readSessionUser(session: unknown): SessionUser | null {
  if (typeof session !== "object" || session === null || !("user" in session)) {
    return null;
  }

  const { user } = session;

  if (typeof user !== "object" || user === null) {
    return null;
  }

  return { isAnonymous: "isAnonymous" in user && user.isAnonymous === true };
}

/**
 * What a session check found: no session (null), or its user. Undefined when the check didn't
 * answer (an error), so a failed check never clears the marker.
 */
function readCheckedUser(returned: unknown): SessionUser | null | undefined {
  return returned === null ? null : (readSessionUser(returned) ?? undefined);
}

const updateAccountMarker = createAuthMiddleware(async (context) => {
  const { authCookies, newSession, responseHeaders, returned, sessionConfig } = context.context;
  const setCookies = parseSetCookieHeader(responseHeaders?.get("set-cookie") ?? "");
  const sessionCookie = setCookies.get(authCookies.sessionToken.name);

  const change = getAccountMarkerChange({
    // Only a browser's own request: server renders can't write cookies.
    checkedUser:
      context.path === "/get-session" && context.request ? readCheckedUser(returned) : undefined,
    endsSession: sessionCookie?.["max-age"] === 0,
    hasMarker: Boolean(context.getCookie(ACCOUNT_MARKER_COOKIE)),
    newUser: readSessionUser(newSession),
  });

  if (!change) {
    return;
  }

  context.setCookie(ACCOUNT_MARKER_COOKIE, change === "set" ? "1" : "", {
    httpOnly: true,
    maxAge: change === "set" ? sessionConfig.expiresIn : 0,
    path: "/",
    sameSite: "lax",
    secure: authCookies.sessionToken.attributes.secure,
  });
});

/**
 * Keeps a cookie that says the session belongs to an account, not a guest, so the web proxy can
 * send learners with an account from the home page to Today while guests keep seeing the home
 * page, without reading the database. It's a hint for which page to show, never a permission:
 * every page still checks the session itself.
 */
export function accountMarkerPlugin() {
  return {
    hooks: { after: [{ handler: updateAccountMarker, matcher: () => true }] },
    id: "account-marker",
  } satisfies BetterAuthPlugin;
}
