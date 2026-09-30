import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { toUTCMidnight } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { createModeLearner } from "./fun-rewards-fixtures";
import { tabTo } from "./keyboard-focus";
import { openAs } from "./study-day";

const STUDY_SECONDS = 1500;
const RIGHT_ANSWERS = 12;

test.describe("Logbook", () => {
  test("Fun: the week as a short story, from the numbers to next week", async ({ browser }) => {
    const { user } = await createModeLearner("fun");

    await dailyProgressFixtureMany([
      {
        correctAnswers: RIGHT_ANSWERS,
        // Today, as the ledger stores learner-local days (UTC for these learners).
        date: toUTCMidnight(new Date()),
        timeSpentSeconds: STUDY_SECONDS,
        userId: user.id,
      },
    ]);

    const page = await openAs(browser, user);

    // The server and the browser format the week's dates differently unless they agree on spaces.
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/logbook");

    await expect(page.getByRole("heading", { name: /What a week/u })).toBeVisible();
    await expect(page.getByText("1 day", { exact: true })).toBeVisible();
    await expect(page.getByText("25 min", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "What Zu ate" })).toBeVisible();

    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("Ready for next week?")).toBeVisible();
    await expect(page.getByRole("link", { name: "Let's go" })).toHaveAttribute("href", "/today");

    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("heading", { name: "What Zu ate" })).toBeVisible();
    expect(pageErrors).toStrictEqual([]);

    await page.context().close();
  });

  test("Fun by keyboard: Enter turns the page, a focused Back goes back, the end leads to Today", async ({
    browser,
  }) => {
    const { user } = await createModeLearner("fun");
    const page = await openAs(browser, user);

    await page.setViewportSize({ height: 900, width: 1280 });
    await page.goto("/logbook");
    await expect(page.getByRole("button", { name: "Next" })).toBeVisible();

    // Keys work once the page hydrates, so the first press retries until the page turns.
    await expect(async () => {
      await page.keyboard.press("Enter");

      await expect(page.getByRole("heading", { name: "What Zu ate" })).toBeVisible({
        timeout: 1000,
      });
    }).toPass({ timeout: 5000 });

    // Enter on a focused Back presses Back instead of turning the page.
    await tabTo(page, page.getByRole("button", { name: "Back" }));
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "What Zu ate" })).toBeHidden();

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("Ready for next week?")).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/today$/u);
    await page.context().close();
  });

  test("Focus: the same week as a calm weekly summary", async ({ browser }) => {
    const { user } = await createModeLearner("focus");
    const page = await openAs(browser, user);

    await page.goto("/logbook");

    await expect(page.getByRole("heading", { name: "Weekly summary" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "A quiet week" })).toBeVisible();

    await expect(
      page.getByText("Monday starts fresh, and your plan already made room."),
    ).toBeVisible();

    await expect(page.getByRole("heading", { name: "What you learned" })).toBeVisible();

    await expect(page.getByRole("link", { name: "Close weekly summary" })).toHaveAttribute(
      "href",
      "/progress",
    );

    // Enter follows the one next step, back to studying.
    await expect(async () => {
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/today$/u, { timeout: 1000 });
    }).toPass({ timeout: 5000 });

    await page.context().close();
  });
});
