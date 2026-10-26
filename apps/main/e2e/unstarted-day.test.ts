import { prisma } from "@zoonk/db";
import { type Page, expect, test } from "./fixtures";
import { openAs } from "./study-day";
import { createUnstartedDay } from "./unstarted-day-fixtures";

function todaySession(page: Page) {
  return page.getByRole("region", { name: "Today's session" });
}

/** Today's steps as the learner reads them: each one's title (its first line) and minutes (its last). */
async function readTodaySteps(page: Page) {
  const rows = todaySession(page).getByRole("listitem");
  await expect(rows).toHaveCount(4);
  const texts = await rows.allInnerTexts();

  return texts.map((text) => {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    return { minutes: lines.at(-1) ?? "", title: lines[0] ?? "" };
  });
}

/**
 * Today, read and settled: its prefetches (the session screen's among them) have landed, so
 * whatever the page's load could have saved is saved by now.
 */
async function openToday(page: Page) {
  const sessionFrame = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/session" &&
      (response.request().headers()["next-router-segment-prefetch"] ?? "").endsWith("/__PAGE__"),
  );

  await page.goto("/today");
  await expect(page.getByRole("button", { name: "Start session" })).toBeEnabled();
  await sessionFrame;
  await page.waitForLoadState("networkidle");
}

function countSessions(userId: string) {
  return prisma.studySession.count({ where: { userId } });
}

test.describe("An unstarted day", () => {
  test("Today previews the day without saving it, and the day it opens is the day Today showed", async ({
    browser,
  }) => {
    const day = await createUnstartedDay();
    const page = await openAs(browser, day.user);

    await openToday(page);
    const shown = await readTodaySteps(page);
    await expect(countSessions(day.user.id)).resolves.toBe(0);

    // Start opens that day, and Today goes on with it.
    await page.getByRole("button", { name: "Start session" }).click();
    await expect(page.getByRole("heading", { name: day.reviewQuestion })).toBeVisible();

    await page.getByRole("link", { name: "Close. Your answers are saved." }).click();
    await expect(page).toHaveURL(/\/today$/u);

    await expect(page.getByRole("button", { name: "Continue session" })).toBeVisible();
    await expect.poll(() => readTodaySteps(page)).toStrictEqual(shown);
    await expect(countSessions(day.user.id)).resolves.toBe(1);
    await page.context().close();
  });
});
