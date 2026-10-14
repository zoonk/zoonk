import { type Browser } from "@playwright/test";
import { ONBOARDING_QUESTIONS } from "@zoonk/core/view-models/onboarding/contract";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { type E2EUser, createE2EUser } from "@zoonk/e2e/fixtures/users";
import { isJsonObject } from "@zoonk/utils/json";

/** Every onboarding screen before the plan's reveal: a guest with a plan went through them all. */
const ONBOARDING_SCREENS = [...ONBOARDING_QUESTIONS, "buddy", "placement"];

/**
 * Records that the learner's goals went through onboarding: a guest's Today waits for the screens
 * still ahead of a goal's plan, and a fixture's goal never showed any.
 */
async function finishOnboarding(userId: string) {
  const goals = await prisma.goal.findMany({
    select: { details: true, id: true },
    where: { userId },
  });

  await Promise.all(
    goals.map(({ details, id }) => {
      const saved = isJsonObject(details) ? details : {};
      const answered = Array.isArray(saved.answered) ? saved.answered : [];

      return prisma.goal.update({
        data: {
          details: { ...saved, answered: [...new Set([...answered, ...ONBOARDING_SCREENS])] },
        },
        where: { id },
      });
    }),
  );
}

/**
 * Opens a learner made by a fixture as a guest: someone who tried lessons without an account, so
 * they have a session but no account yet, and reached their plans through onboarding. The session
 * cookie's cached copy still says "signed up": dropping it makes the server read the guest. A
 * persona's browser is in its own time zone.
 */
export async function openUserAsGuest(browser: Browser, user: E2EUser & { timeZone?: string }) {
  await Promise.all([
    prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } }),
    finishOnboarding(user.id),
  ]);

  const context = await browser.newContext({
    storageState: user.storageState,
    ...(user.timeZone && { timezoneId: user.timeZone }),
  });

  await context.clearCookies({ name: /session_data/u });

  return { context, page: await context.newPage() };
}

/** A new guest, with a session and nothing else. */
export async function openAsGuest(browser: Browser) {
  const user = await createE2EUser(getBaseURL());
  return { ...(await openUserAsGuest(browser, user)), user };
}
