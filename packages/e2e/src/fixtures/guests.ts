import { type Page } from "@playwright/test";
import { getString, isJsonObject } from "@zoonk/utils/json";
import { getBaseURL } from "./base-url";

async function readSessionUserId(page: Page): Promise<string | null> {
  const response = await page.request.get("/api/auth/get-session");
  const session: unknown = response.ok() ? await response.json() : null;

  return isJsonObject(session) ? getString(session.user, "id") : null;
}

/**
 * The id of the page's learner, signing a visitor in as a guest first through the real auth API,
 * as sending a goal does. A test that stores what a learner's words mean needs whose words they
 * are before they type them: a reading is its learner's own. A signed-in learner or a guest keeps
 * their session, so sending the goal later starts no other guest.
 */
export async function ensureGuest(page: Page): Promise<string> {
  const current = await readSessionUserId(page);

  if (current) {
    return current;
  }

  const response = await page.request.post("/api/auth/sign-in/anonymous", {
    data: {},
    headers: { Origin: getBaseURL() },
  });

  if (!response.ok()) {
    throw new Error(`Guest sign-in failed: ${response.status()} - ${await response.text()}`);
  }

  const guestId = await readSessionUserId(page);

  if (!guestId) {
    throw new Error("The guest sign-in left no session.");
  }

  return guestId;
}
