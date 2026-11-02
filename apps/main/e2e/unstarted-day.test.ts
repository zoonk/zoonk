import { prisma } from "@zoonk/db";
import { type Page, expect, test } from "./fixtures";
import { openAs } from "./study-day";
import { createUnstartedDay } from "./unstarted-day-fixtures";

function todaySession(page: Page) {
  return page.getByRole("region", { name: "Today's session" });
}

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

/** Waits for its prefetches too, so anything the page's load could have saved is saved by now. */
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

    await page.getByRole("button", { name: "Start session" }).click();
    await expect(page.getByRole("heading", { name: day.reviewQuestion })).toBeVisible();

    await page.getByRole("link", { name: "Close. Your answers are saved." }).click();
    await expect(page).toHaveURL(/\/today$/u);

    await expect(page.getByRole("button", { name: "Continue session" })).toBeVisible();
    await expect.poll(() => readTodaySteps(page)).toStrictEqual(shown);
    await expect(countSessions(day.user.id)).resolves.toBe(1);
    await page.context().close();
  });

  test("Today kept in the history reads again when the learner goes back to it five minutes later", async ({
    browser,
  }) => {
    const day = await createUnstartedDay();
    const page = await openAs(browser, day.user);

    await page.clock.install();
    await openToday(page);
    await page.getByRole("link", { exact: true, name: "Plan" }).click();
    await expect(page).toHaveURL(/\/plan$/u);

    const phone = await openAs(browser, day.user);
    await phone.goto("/today");
    await phone.getByRole("button", { name: "Start session" }).click();
    await expect(phone.getByRole("heading", { name: day.reviewQuestion })).toBeVisible();
    await phone.context().close();

    await page.clock.fastForward("05:00");
    await page.goBack();
    await expect(page).toHaveURL(/\/today$/u);
    await expect(page.getByRole("button", { name: "Continue session" })).toBeVisible();
    await page.context().close();
  });
});
