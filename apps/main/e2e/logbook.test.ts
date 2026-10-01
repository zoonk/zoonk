import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { toUTCMidnight } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { createModeLearner } from "./fun-rewards-fixtures";
import { tabTo } from "./keyboard-focus";
import { openAs } from "./study-day";

const STUDY_SECONDS = 1500;
const RIGHT_ANSWERS = 12;

test.describe("Logbook", () => {
  test("Fun: the week as a short story, turned by pointer and keyboard, to next week and Today", async ({
    browser,
  }) => {
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

    await page.setViewportSize({ height: 900, width: 1280 });
    await page.goto("/logbook");

    await expect(page.getByRole("heading", { name: /What a week/u })).toBeVisible();
    await expect(page.getByText("1 day", { exact: true })).toBeVisible();
    await expect(page.getByText("25 min", { exact: true })).toBeVisible();
    await expectAccessibleScreen(page, "the logbook");

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "What Zu ate" })).toBeVisible();

    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("Ready for next week?")).toBeVisible();
    await expect(page.getByRole("link", { name: "Let's go" })).toHaveAttribute("href", "/today");

    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("heading", { name: "What Zu ate" })).toBeVisible();

    // Enter on a focused Back presses Back instead of turning the page.
    await tabTo(page, page.getByRole("button", { name: "Back" }));
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "What Zu ate" })).toBeHidden();

    // Elsewhere, Enter turns the page.
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "What Zu ate" })).toBeVisible();

    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("Ready for next week?")).toBeVisible();
    expect(pageErrors).toStrictEqual([]);

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
    await expectAccessibleScreen(page, "the weekly summary");

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
