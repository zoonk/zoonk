import { type request } from "@playwright/test";

type StorageState = Awaited<
  ReturnType<Awaited<ReturnType<typeof request.newContext>>["storageState"]>
>;

/** Main's session hint (`SESSION_HINT_COOKIE` in `apps/main/src/lib/learner/session-hint.ts`). */
const SESSION_HINT_COOKIE = "zoonk-signed-in";

/**
 * A browser signed in through the auth API, as one signed in through the app's sign-in holds it:
 * with main's session hint beside the session cookie, for as long, so pages without a server render
 * of the learner (the catalog, public pages, the player) read their summary.
 */
export function withSessionHint(state: StorageState): StorageState {
  const session = state.cookies.find((cookie) => cookie.name.endsWith("session_token"));

  if (!session) {
    return state;
  }

  const hint = { ...session, httpOnly: false, name: SESSION_HINT_COOKIE, value: "1" };
  return { ...state, cookies: [...state.cookies, hint] };
}
