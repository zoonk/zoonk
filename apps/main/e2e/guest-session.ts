import { type Browser } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { type E2EUser, createE2EUser } from "@zoonk/e2e/fixtures/users";

/**
 * Opens a learner made by a fixture as a guest: someone who tried lessons without an account, so
 * they have a session but no account yet. The session cookie's cached copy still says "signed
 * up": dropping it makes the server read the guest.
 */
export async function openUserAsGuest(browser: Browser, user: E2EUser) {
  await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });

  const context = await browser.newContext({ storageState: user.storageState, timezoneId: "UTC" });
  await context.clearCookies({ name: /session_data/u });

  return { context, page: await context.newPage() };
}

/** A new guest, with a session and nothing else. */
export async function openAsGuest(browser: Browser) {
  const user = await createE2EUser(getBaseURL());
  return { ...(await openUserAsGuest(browser, user)), user };
}
