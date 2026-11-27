import { type Page } from "@playwright/test";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { expectHydrated } from "@zoonk/e2e/hydration";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { expect, test } from "./fixtures";
import { openAs } from "./study-day";

const LESSONS = 12;

function isRenting(index: number) {
  return index % 3 === 0;
}

/** Twelve lessons finished over two months, eight in one module and four in the other. */
async function createLearnerWithHistory() {
  const [user, lessons] = await Promise.all([
    createE2EUser(getBaseURL()),
    Promise.all(
      Array.from({ length: LESSONS }, (_, index) =>
        libraryLessonFixture({ title: `Lesson ${index + 1}` }),
      ),
    ),
  ]);

  const goal = await goalFixture({ userId: user.id });

  await Promise.all([
    planFixture({
      goalId: goal.id,
      items: lessons.map((lesson, index) => ({
        lessonId: lesson.id,
        phase: isRenting(index) ? 1 : 0,
        status: "done",
      })),
      phases: [{ name: "Arriving" }, { name: "Renting a flat" }],
    }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ...lessons.map((lesson, index) =>
      learningEventFixture({
        contentIds: { lessonId: lesson.id },
        endedAt: new Date(Date.UTC(2026, 8, 25 + index, 15)),
        goalId: goal.id,
        lessonKind: "library",
        userId: user.id,
      }),
    ),
  ]);

  return user;
}

function lessonLinks(page: Page) {
  return page.getByRole("main").getByRole("link", { name: /^Lesson \d+/u });
}

async function readTop(page: Page, name: string) {
  const box = await page.getByRole("heading", { level: 2, name }).boundingBox();
  return box?.y;
}

test.describe("Completed lessons", () => {
  test("a subject beside the list narrows it in place, and All brings every lesson back", async ({
    browser,
  }) => {
    const page = await openAs(browser, await createLearnerWithHistory());
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto("/completed-lessons");

    const modules = page.getByRole("complementary", { name: "Modules" });
    const renting = modules.getByRole("link", { name: "Renting a flat 4" });
    await expectHydrated(renting);

    await expect(modules.getByRole("link", { name: "All 12" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await expect(modules.getByRole("link", { name: "Arriving 8" })).toBeVisible();
    await expect(lessonLinks(page)).toHaveCount(LESSONS);
    await expect(page.getByRole("region", { name: "October" }).getByRole("link")).toHaveCount(6);

    const top = await readTop(page, "October");
    await renting.click();

    await expect(page).toHaveURL(/\/completed-lessons\?group=renting-a-flat$/u);
    await expect(renting).toHaveAttribute("aria-current", "page");

    await expect(lessonLinks(page)).toHaveText([
      /^Lesson 10/u,
      /^Lesson 7/u,
      /^Lesson 4/u,
      /^Lesson 1/u,
    ]);

    expect(await readTop(page, "October")).toBe(top);

    await page.reload();
    await expect(lessonLinks(page)).toHaveCount(4);

    await modules.getByRole("link", { name: "All 12" }).click();
    await expect(page).toHaveURL(/\/completed-lessons$/u);
    await expect(lessonLinks(page)).toHaveCount(LESSONS);
    await page.context().close();
  });

  test("on a phone the subjects are a row over the list", async ({ browser }) => {
    const page = await openAs(browser, await createLearnerWithHistory());
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/completed-lessons");

    const modules = page.getByRole("navigation", { name: "Modules" });
    const arriving = modules.getByRole("link", { name: "Arriving 8" });
    await expect(page.getByRole("complementary", { name: "Modules" })).toBeHidden();

    await arriving.click();
    await expect(arriving).toHaveAttribute("aria-current", "page");
    await expect(lessonLinks(page)).toHaveCount(8);
    await page.context().close();
  });
});
