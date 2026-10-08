import { type Browser, type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { type E2EPersona, createE2EPersona } from "@zoonk/e2e/fixtures/personas";

type PersonaName = Parameters<typeof createE2EPersona>[1]["persona"];

/**
 * Runs a test as a private copy of a v2 persona, so it can change the learner's plan, answers or
 * goals without touching the shared personas other tests read.
 */
export async function asPersona(
  browser: Browser,
  { persona }: { persona: PersonaName },
  run: (session: { page: Page; user: E2EPersona }) => Promise<void>,
) {
  const user = await createE2EPersona(getBaseURL(), { persona });
  const context = await browser.newContext({ storageState: user.storageState });
  const page = await context.newPage();

  try {
    await run({ page, user });
  } finally {
    await context.close();
  }
}

/** The id of a chapter in the persona's plan, by its title. */
export async function findPlanChapterId(goalId: string, title: string) {
  const item = await prisma.planItem.findFirstOrThrow({
    where: { chapter: { title }, plan: { goalId } },
  });

  return item.chapterId ?? "";
}
