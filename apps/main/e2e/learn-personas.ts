import { type Browser, type BrowserContext, type Page, expect } from "@playwright/test";
import { EXPERIENCE_MODE_COOKIE } from "@zoonk/core/profile/mode-cookie";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { type E2EPersona, createE2EPersona } from "@zoonk/e2e/fixtures/personas";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";

export const MODES = ["focus", "fun"] as const;

export type Mode = (typeof MODES)[number];

type PersonaName = Parameters<typeof createE2EPersona>[1]["persona"];

/**
 * Runs a test as a private copy of a v2 persona in the given mode, so it can change the learner's
 * plan, answers or goals without touching the shared personas other tests read.
 */
export async function asPersona(
  browser: Browser,
  { mode, persona }: { mode: Mode; persona: PersonaName },
  run: (session: { page: Page; user: E2EPersona }) => Promise<void>,
) {
  const user = await createE2EPersona(getBaseURL(), { mode, persona });
  const context = await browser.newContext({ storageState: user.storageState });
  const page = await context.newPage();

  try {
    await run({ page, user });
  } finally {
    await context.close();
  }
}

/** Keeps `mode` on the device, as a visitor's pick does before they have a profile. */
export async function setDeviceMode(context: BrowserContext, mode: Mode) {
  await context.addCookies([{ name: EXPERIENCE_MODE_COOKIE, url: getBaseURL(), value: mode }]);
}

/** The mode the device keeps, if any. */
export async function readDeviceMode(context: BrowserContext) {
  const cookies = await context.cookies();
  return cookies.find((cookie) => cookie.name === EXPERIENCE_MODE_COOKIE)?.value;
}

/** The id of a chapter in the persona's plan, by its title. */
export async function findPlanChapterId(goalId: string, title: string) {
  const item = await prisma.planItem.findFirstOrThrow({
    where: { chapter: { title }, plan: { goalId } },
  });

  return item.chapterId ?? "";
}

/**
 * Shows a learner's pages in `mode`, as after picking it in Appearance: their profile saves it and
 * the device's cookie says it.
 */
export async function showInMode(
  context: BrowserContext,
  { mode, userId }: { mode: Mode; userId: string },
) {
  await Promise.all([
    learningProfileFixture({ experienceMode: mode, userId }),
    setDeviceMode(context, mode),
  ]);
}

/**
 * The page renders in `mode`, so a Fun run never passes by showing Focus. `<html>` takes the mode
 * from the learner's frame, not from the skeleton before it, which only knows the device's.
 */
export async function expectMode(page: Page, mode: Mode) {
  await expect(page.locator("html")).toHaveAttribute("data-mode", mode);
}
