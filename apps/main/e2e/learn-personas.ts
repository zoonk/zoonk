import { type Browser, type Page } from "@playwright/test";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { type E2EPersona, createE2EPersona } from "@zoonk/e2e/fixtures/personas";

type PersonaName = Parameters<typeof createE2EPersona>[1]["persona"];

/**
 * Opens a page as a persona, on a device in the persona's own time zone, like the learner who set
 * up the goal there: Today and the session's actions then read the same day at any hour.
 */
async function openPersona(browser: Browser, user: E2EPersona) {
  const context = await browser.newContext({
    storageState: user.storageState,
    timezoneId: user.timeZone,
  });

  return { context, page: await context.newPage() };
}

/**
 * Runs a test as a private copy of a v2 persona, so it can change the learner's plan, answers or
 * goals without touching the shared personas other tests read.
 */
export async function asPersona(
  browser: Browser,
  {
    away,
    day,
    persona,
    timeZone,
  }: { away?: number; day?: number; persona: PersonaName; timeZone?: string },
  run: (session: { page: Page; user: E2EPersona }) => Promise<void>,
) {
  const user = await createE2EPersona(getBaseURL(), { away, day, persona, timeZone });
  const { context, page } = await openPersona(browser, user);

  try {
    await run({ page, user });
  } finally {
    await context.close();
  }
}
