import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { RENTING_SCENARIO } from "@zoonk/testing/fixtures/language";
import { expect, test } from "./fixtures";
import { createLanguageChallenge } from "./language-challenge-fixtures";
import { openAs } from "./study-day";

async function readLearnerState(userId: string) {
  const [sessions, conversations, aiCalls, usage, items] = await Promise.all([
    prisma.studySession.findMany({
      include: { blocks: { orderBy: { position: "asc" } } },
      orderBy: { localDate: "asc" },
      where: { userId },
    }),
    prisma.languageConversation.count({ where: { userId } }),
    prisma.aiCall.count({ where: { userId } }),
    prisma.usageRecord.count({ where: { userId } }),
    prisma.planItem.findMany({
      orderBy: { position: "asc" },
      where: { plan: { goal: { userId } } },
    }),
  ]);

  return { aiCalls, conversations, items, sessions, usage };
}

function pagePrefetched(page: Page, path: string) {
  return page.waitForResponse((response) => {
    const headers = response.request().headers();

    return (
      new URL(response.url()).pathname === path &&
      Boolean(headers["next-router-prefetch"] ?? headers["next-router-segment-prefetch"])
    );
  });
}

test("Today's call link and the call's page write nothing until the learner starts the call", async ({
  browser,
}) => {
  const { block, user } = await createLanguageChallenge({ plus: true });
  const href = `/checkpoint/${block.id}?session=${block.sessionId}`;
  const before = await readLearnerState(user.id);
  const page = await openAs(browser, user);
  const prefetched = pagePrefetched(page, `/checkpoint/${block.id}`);

  await page.goto("/today");

  await expect(page.getByRole("link", { name: /^(?:Start|Continue) session/u })).toHaveAttribute(
    "href",
    href,
  );

  const prefetch = await prefetched;
  await prefetch.finished();

  const title = page.getByRole("heading", { level: 1, name: RENTING_SCENARIO.title });
  await page.goto(href);
  await expect(title).toBeVisible();
  await page.reload();
  await expect(title).toBeVisible();

  await expect(readLearnerState(user.id)).resolves.toStrictEqual(before);
  await page.context().close();
});
