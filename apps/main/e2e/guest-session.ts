import { type Browser } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";

/**
 * A new guest, with a session and nothing else: someone who tried lessons without an account. The
 * session cookie's cached copy still says "signed up": dropping it makes the server read the guest.
 */
export async function openAsGuest(browser: Browser) {
  const user = await createE2EUser(getBaseURL());
  await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });

  const context = await browser.newContext({ storageState: user.storageState });
  await context.clearCookies({ name: /session_data/u });

  return { context, page: await context.newPage() };
}
