import { instant } from "@next/playwright";
import { type Page } from "@playwright/test";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { expect, test } from "./fixtures";
import { asPersona, findPlanChapterId } from "./learn-personas";
import { openAs } from "./study-day";

/** A chapter of Maya's plan with a lesson up next. */
const CHAPTER = "Exponents and scientific notation";

/**
 * The page's own content is painted, with no loading placeholder left in it. Inside `instant()`
 * nothing that isn't prefetched or cached reaches the page, so this is what the tap shows at once.
 */
async function expectPainted(page: Page) {
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(main.locator('[data-slot="skeleton"]')).toHaveCount(0);
}

/** Links prefetch once they're on screen; the page is ready to tap once those have landed. */
async function openSettled(page: Page, path: string) {
  await page.goto(path);
  await expectPainted(page);
  await page.waitForLoadState("networkidle");
}

/** Taps a link and checks the destination paints from its prefetch, before any server reply. */
async function tapInstantly({ link, page, path }: { link: string; page: Page; path: RegExp }) {
  await instant(page, async () => {
    await page.locator(`a[href="${link}"]:visible`).first().click();
    await page.waitForURL(path);
    await expectPainted(page);
  });
}

/**
 * A learner whose plan has one chapter of three lessons: the next one and another one written, and
 * a last one not written yet.
 */
async function createChapterLearner() {
  const user = await createE2EUser(getBaseURL());

  const [goal, chapter, next, written, unwritten] = await Promise.all([
    goalFixture({ timezone: "UTC", title: "Learn percentages", userId: user.id }),
    libraryChapterFixture({ title: "Percentages" }),
    playableLessonFixture({ lesson: { title: "What a percent is" } }),
    playableLessonFixture({ lesson: { title: "Percent of a number" } }),
    libraryLessonFixture({ title: "Percent change" }),
  ]);

  const lessons = [next.lesson, written.lesson, unwritten];

  const [plan] = await Promise.all([
    planFixture({ goalId: goal.id }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ...lessons.map((lesson, position) =>
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position }),
    ),
  ]);

  await Promise.all(
    lessons.map((lesson, position) =>
      planItemFixture({ chapterId: chapter.id, lessonId: lesson.id, planId: plan.id, position }),
    ),
  );

  return { chapter, unwritten, user, written: written.lesson };
}

test.describe("Instant navigation", () => {
  test("Today, the Journey and the buddy open with their content at once, both ways", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "hugeGoal" }, async ({ page }) => {
      await openSettled(page, "/today");

      await tapInstantly({ link: "/journey", page, path: /\/journey$/u });
      await page.waitForLoadState("networkidle");

      // The buddy's conversation comes with the tab: no wait for its messages.
      await tapInstantly({ link: "/buddy", page, path: /\/buddy$/u });
      await expect(page.getByRole("log")).toBeVisible();
      await page.waitForLoadState("networkidle");

      await tapInstantly({ link: "/today", page, path: /\/today$/u });
    });
  });

  test("a chapter's next lesson opens at once", async ({ browser }) => {
    await asPersona(browser, { persona: "hugeGoal" }, async ({ page, user }) => {
      const chapterId = await findPlanChapterId(user.goalId, CHAPTER);
      await openSettled(page, `/content/chapters/${chapterId}`);

      const next = page
        .getByRole("region", { name: "Lessons" })
        .getByRole("link", { name: /^Up next /u });

      const href = await next.getAttribute("href");

      await instant(page, async () => {
        await next.click();
        await page.waitForURL(new RegExp(`${href}$`, "u"));
        // The player itself, at its first screen: its progress bar, and no placeholder.
        await expect(page.getByRole("progressbar").first()).toBeVisible();
        await expect(page.getByRole("main").locator('[data-slot="skeleton"]')).toHaveCount(0);
      });
    });
  });

  test("a chapter's written lessons open at once; one not written yet loads on the tap", async ({
    browser,
  }) => {
    const { chapter, unwritten, user, written } = await createChapterLearner();
    const page = await openAs(browser, user);
    await openSettled(page, `/content/chapters/${chapter.id}`);

    const lessons = page.getByRole("region", { name: "Lessons" });

    // Reading the plan's written lessons counts toward no limit, so the list loads them ahead.
    await instant(page, async () => {
      await lessons.getByRole("link", { name: /Percent of a number/u }).click();
      await page.waitForURL(new RegExp(`/learn/${written.id}$`, "u"));
      await expect(page.getByRole("progressbar").first()).toBeVisible();
      await expect(page.getByRole("main").locator('[data-slot="skeleton"]')).toHaveCount(0);
    });

    await page.goBack();
    await expectPainted(page);

    // One not written yet has nothing to load ahead: the player's frame waits for the tap.
    await instant(page, async () => {
      await lessons.getByRole("link", { name: /Percent change/u }).click();
      await page.waitForURL(new RegExp(`/learn/${unwritten.id}$`, "u"));
      await expect(page.locator('[data-slot="skeleton"]').first()).toBeVisible();
    });

    await page.context().close();
  });
});
