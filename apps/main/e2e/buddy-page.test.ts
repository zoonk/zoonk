import { prisma } from "@zoonk/db";
import { expectAccessibleRoutes, expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { toUTCMidnight } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { createModeLearner } from "./fun-rewards-fixtures";
import { openAs } from "./study-day";

const BOSS_QUESTIONS = 10;
const STUDY_SECONDS = 600;

const BOSS_RIGHT = 8;

async function wornGlasses(userId: string) {
  const profile = await prisma.userLearningProfile.findUniqueOrThrow({ where: { userId } });
  return profile.buddyGlasses;
}

test.describe("Buddy page", () => {
  test("Fun: the dock's buddy leads to its page, earned glasses go on with one tap, and studying wakes it", async ({
    browser,
  }) => {
    const { user } = await createModeLearner("fun");

    // A boss won earned the Star glasses: the ledger counts it and the milestone records it.
    await Promise.all([
      learningEventFixture({
        correctAnswers: BOSS_RIGHT,
        incorrectAnswers: BOSS_QUESTIONS - BOSS_RIGHT,
        kind: "checkpoint",
        lessonKind: "boss",
        userId: user.id,
      }),
      prisma.milestone.create({ data: { key: "star", kind: "glasses", userId: user.id } }),
    ]);

    const page = await openAs(browser, user);

    await page.goto("/buddy");

    const dockBuddy = page.getByRole("link", { exact: true, name: "Zu" });
    await expect(dockBuddy).toHaveAttribute("href", "/buddy");
    await expect(dockBuddy).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 1, name: /Zu/u })).toBeVisible();

    // No study yet today and no Energy: the buddy naps, and nothing scolds.
    await expect(
      page.getByText("Zu took a nap. Everything you learn helps it wake up."),
    ).toBeVisible();

    await expect(page.getByText("This week Zu ate")).toBeVisible();
    await expect(page.getByText("2 of 6")).toBeVisible();
    await expect(page.getByText("0/7 full meals")).toBeVisible();
    await expectAccessibleScreen(page, "the buddy page");

    const star = page.getByRole("button", { name: /Star/u });
    await star.click();

    await expect(star).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => wornGlasses(user.id)).toBe("star");

    // The pair being worn can't be tapped again, yet it keeps focus instead of dropping it.
    await expect(star).toBeDisabled();
    await expect(star).toBeFocused();
    await expect(page.getByRole("button", { name: /Monocle/u })).toBeDisabled();

    // Studying today wakes it, however low Energy is.
    await dailyProgressFixtureMany([
      {
        correctAnswers: 3,
        date: toUTCMidnight(new Date()),
        timeSpentSeconds: STUDY_SECONDS,
        userId: user.id,
      },
    ]);

    await page.reload();

    await expect(page.getByText("That was tasty. Thank you!")).toBeVisible();
    await expect(page.getByText(/took a nap/u)).toHaveCount(0);
    await expect(page.getByRole("img", { name: "Zu" })).toHaveAttribute("data-energy", "awake");

    // No Fun flow passes through My courses, so it's scanned here.
    await expectAccessibleRoutes(page, [{ path: "/my" }]);
    await page.context().close();
  });

  test("Focus: buddies live in Fun, so the page says how to get one", async ({ browser }) => {
    const { user } = await createModeLearner("focus");
    const page = await openAs(browser, user);

    await page.goto("/buddy");

    await expect(page.getByRole("heading", { name: "Buddies live in Fun mode" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Appearance" })).toBeVisible();
    await expectAccessibleScreen(page, "the buddy page");
    await page.context().close();
  });

  test("Fun without a buddy: switching modes in Appearance picks none, so the page asks for one", async ({
    browser,
  }) => {
    const { user } = await createModeLearner("focus");

    await prisma.userLearningProfile.update({
      data: { experienceMode: "fun" },
      where: { userId: user.id },
    });

    const page = await openAs(browser, user);
    await page.goto("/buddy");

    // The dock has a plain Buddy item until one is picked.
    const dock = page
      .getByRole("navigation")
      .filter({ has: page.getByRole("link", { name: "Route" }) });

    await expect(dock.getByRole("link")).toHaveText(["Today", "Route", "Cards", "Buddy"]);
    const dockBuddy = dock.getByRole("link", { name: "Buddy" });
    await expect(dockBuddy).toHaveAttribute("href", "/buddy");
    await expect(dockBuddy).toHaveAttribute("aria-current", "page");

    await expect(page.getByRole("heading", { level: 1, name: "Pick your buddy" })).toBeVisible();

    await expect(page.getByRole("link", { name: "Open Appearance" })).toHaveAttribute(
      "href",
      "/settings/appearance",
    );

    await page.context().close();
  });
});
