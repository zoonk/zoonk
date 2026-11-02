import { type Browser, type Page } from "@playwright/test";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { type E2EPersona, createE2EPersona } from "@zoonk/e2e/fixtures/personas";

type PersonaName = Parameters<typeof createE2EPersona>[1]["persona"];

/** In the persona's own time zone, so Today and the session's actions read the same day at any hour. */
async function openPersona(browser: Browser, user: E2EPersona) {
  const context = await browser.newContext({
    storageState: user.storageState,
    timezoneId: user.timeZone,
  });

  return { context, page: await context.newPage() };
}

export async function asPersona(
  browser: Browser,
  { persona }: { persona: PersonaName },
  run: (session: { page: Page; user: E2EPersona }) => Promise<void>,
) {
  const user = await createE2EPersona(getBaseURL(), { persona });
  const { context, page } = await openPersona(browser, user);

  try {
    await run({ page, user });
  } finally {
    await context.close();
  }
}
