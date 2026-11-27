import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { expectHydrated } from "@zoonk/e2e/hydration";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { type Page, expect, test } from "./fixtures";
import { openAs, waitForLessonStart } from "./study-day";

/** A learner whose plan has two one-screen lessons in one chapter, the first already finished. */
async function createLearner() {
  const suffix = randomUUID().slice(0, 6);

  const [user, chapter, first, second] = await Promise.all([
    createE2EUser(getBaseURL()),
    libraryChapterFixture({ title: `Inside the atom ${suffix}` }),
    playableLessonFixture({
      lesson: { title: `An almost empty atom ${suffix}` },
      steps: ["explanation"],
    }),
    playableLessonFixture({
      lesson: { title: `Why it doesn't fall ${suffix}` },
      steps: ["explanation"],
    }),
  ]);

  const goal = await goalFixture({ timezone: "UTC", userId: user.id });
  const lessons = [first.lesson, second.lesson];

  await Promise.all([
    planFixture({
      goalId: goal.id,
      items: lessons.map((lesson, index) => ({
        chapterId: chapter.id,
        lessonId: lesson.id,
        status: index === 0 ? "done" : "todo",
      })),
    }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    learningEventFixture({
      contentIds: { lessonId: first.lesson.id },
      endedAt: new Date(),
      goalId: goal.id,
      lessonKind: "library",
      userId: user.id,
    }),
    ...lessons.flatMap((lesson, position) => [
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position }),
      prisma.lesson.update({ data: { homeChapterId: chapter.id }, where: { id: lesson.id } }),
    ]),
  ]);

  return { chapter, finished: first.lesson, goal, unfinished: second.lesson, user };
}

function savedCount(userId: string) {
  return prisma.savedLesson.count({ where: { userId } });
}

function sidebarRow(page: Page) {
  return page
    .getByRole("complementary", { name: "Sidebar" })
    .getByRole("link", { name: "Saved lessons" });
}

test.describe("Saved lessons", () => {
  test("a lesson saved from the player's header stays saved to its end, and its page joins the sidebar", async ({
    browser,
  }) => {
    const { unfinished, user } = await createLearner();
    const page = await openAs(browser, user);
    await page.setViewportSize({ height: 900, width: 1440 });

    try {
      await page.goto("/today");
      await expectHydrated(page.getByRole("link", { name: "Mistakes notebook" }));
      await expect(sidebarRow(page)).toHaveCount(0);

      const started = waitForLessonStart(page, unfinished.id);
      await page.goto(`/learn/${unfinished.id}`);
      await started;

      const save = page.getByRole("button", { exact: true, name: "Save" });
      await expect(save).toHaveAttribute("aria-pressed", "false");
      await save.click();

      const saved = page.getByRole("button", { exact: true, name: "Saved" });
      await expect(saved).toHaveAttribute("aria-pressed", "true");
      await expect.poll(() => savedCount(user.id)).toBe(1);

      await page.getByRole("button", { name: /^Continue/u }).click();
      await expect(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
      await expect(saved).toHaveAttribute("aria-pressed", "true");

      await page.getByRole("link", { name: "Leave" }).click();
      await expect(page).not.toHaveURL(/\/learn\//u);
      await sidebarRow(page).click();

      await expect(page.getByRole("heading", { level: 1, name: "Saved lessons" })).toBeVisible();

      await expect(
        page
          .getByRole("list", { name: "Saved lessons" })
          .getByRole("link", { name: unfinished.title }),
      ).toBeVisible();
    } finally {
      await page.context().close();
    }
  });

  test("a finished lesson's bookmark on Completed lessons saves it without opening it, and one that can no longer open has neither", async ({
    browser,
  }) => {
    const { finished, goal, user } = await createLearner();
    const gone = await libraryLessonFixture({ title: `A lesson taken down ${randomUUID()}` });

    await learningEventFixture({
      contentIds: { lessonId: gone.id },
      endedAt: new Date(),
      goalId: goal.id,
      lessonKind: "library",
      userId: user.id,
    });

    const page = await openAs(browser, user);
    await page.setViewportSize({ height: 900, width: 1440 });

    try {
      await page.goto("/completed-lessons");

      const save = page.getByRole("button", { name: `Save ${finished.title}` });
      await expectHydrated(save);
      await expect(sidebarRow(page)).toHaveCount(0);

      const main = page.getByRole("main");
      await expect(main.getByText(gone.title)).toBeVisible();
      await expect(main.getByRole("link", { name: gone.title })).toHaveCount(0);
      await expect(main.getByRole("button", { name: `Save ${gone.title}` })).toHaveCount(0);
      await expect(main.getByRole("link", { name: finished.title })).toBeVisible();

      await expect(save).toHaveAttribute("aria-pressed", "false");
      await save.click();

      await expect(page.getByRole("button", { name: `Saved ${finished.title}` })).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      await expect(page).toHaveURL(/\/completed-lessons$/u);
      await expect.poll(() => savedCount(user.id)).toBe(1);
      await expect(sidebarRow(page)).toBeVisible();

      await page.reload();

      const saved = page.getByRole("button", { name: `Saved ${finished.title}` });
      await expect(saved).toHaveAttribute("aria-pressed", "true");

      await expectHydrated(saved);
      await saved.click();
      await expect.poll(() => savedCount(user.id)).toBe(0);
      await expect(sidebarRow(page)).toHaveCount(0);
    } finally {
      await page.context().close();
    }
  });

  test("Today opens Saved lessons, where a save removed keeps its row to save again, one that can't open leaves at once, and a lesson opened there closes back to it", async ({
    browser,
  }) => {
    const { chapter, finished, goal, unfinished, user } = await createLearner();
    const goneTitle = `A lesson taken down ${randomUUID().slice(0, 6)}`;

    await prisma.savedLesson.createMany({
      data: [
        { goalId: goal.id, lessonId: finished.id, title: finished.title, userId: user.id },
        { goalId: goal.id, lessonId: unfinished.id, title: unfinished.title, userId: user.id },
        { goalId: goal.id, lessonId: randomUUID(), title: goneTitle, userId: user.id },
      ],
    });

    const page = await openAs(browser, user);
    await page.setViewportSize({ height: 844, width: 390 });

    try {
      await page.goto("/today");

      await page
        .getByRole("region", { name: "Practice anytime" })
        .getByRole("link", { name: /^Saved lessons/u })
        .click();

      await expect(page).toHaveURL(/\/saved-lessons$/u);

      const list = page.getByRole("list", { name: "Saved lessons" });
      const row = list.getByRole("link", { name: new RegExp(finished.title, "u") });
      await expect(row).toContainText(chapter.title);

      const remove = list.getByRole("button", { name: `Saved ${finished.title}` });
      await expectHydrated(remove);
      await remove.click();
      await expect.poll(() => savedCount(user.id)).toBe(2);

      const again = list.getByRole("button", { name: `Save ${finished.title}` });
      await expect(again).toHaveAttribute("aria-pressed", "false");
      await expect(row).toBeVisible();

      await again.click();
      await expect.poll(() => savedCount(user.id)).toBe(3);

      const gone = page.getByRole("region", { name: "No longer available" });
      await expect(gone.getByText(goneTitle)).toBeVisible();
      await gone.getByRole("button", { name: "Remove" }).click();
      await expect(gone).toBeHidden();
      await expect.poll(() => savedCount(user.id)).toBe(2);

      const started = waitForLessonStart(page, unfinished.id);
      await list.getByRole("link", { name: new RegExp(unfinished.title, "u") }).click();
      await expect(page).toHaveURL(/from=%2Fsaved-lessons/u);
      await started;

      await page.getByRole("link", { name: "Leave" }).click();
      await expect(page).toHaveURL(/\/saved-lessons$/u);
    } finally {
      await page.context().close();
    }
  });

  test("a save removed on Saved lessons is gone once the learner leaves, by a link or by Back, and the sidebar lets the page go only then", async ({
    browser,
  }) => {
    const { finished, goal, unfinished, user } = await createLearner();

    await prisma.savedLesson.createMany({
      data: [finished, unfinished].map((lesson) => ({
        goalId: goal.id,
        lessonId: lesson.id,
        title: lesson.title,
        userId: user.id,
      })),
    });

    const page = await openAs(browser, user);
    await page.setViewportSize({ height: 900, width: 1440 });

    const sidebar = page.getByRole("complementary", { name: "Sidebar" });
    const list = page.getByRole("list", { name: "Saved lessons" });
    const row = (title: string) => list.getByRole("link", { name: new RegExp(title, "u") });

    try {
      await page.goto("/saved-lessons");

      const remove = list.getByRole("button", { name: `Saved ${finished.title}` });
      await expectHydrated(remove);
      await remove.click();
      await expect.poll(() => savedCount(user.id)).toBe(1);
      await expect(list.getByRole("button", { name: `Save ${finished.title}` })).toBeVisible();

      await sidebar.getByRole("link", { name: "Mistakes notebook" }).click();
      await expect(page).toHaveURL(/\/mistakes/u);
      await sidebarRow(page).click();

      await expect(row(unfinished.title)).toBeVisible();
      await expect(row(finished.title)).toHaveCount(0);

      await list.getByRole("button", { name: `Saved ${unfinished.title}` }).click();
      await expect.poll(() => savedCount(user.id)).toBe(0);
      await expect(row(unfinished.title)).toBeVisible();
      await expect(sidebarRow(page)).toBeVisible();

      await sidebar.getByRole("link", { name: "Mistakes notebook" }).click();
      await expect(sidebarRow(page)).toHaveCount(0);

      await page.goBack();
      await expect(page).toHaveURL(/\/saved-lessons$/u);

      await expect(
        page.getByText("Nothing saved yet. Tap the bookmark on a lesson to keep it here."),
      ).toBeVisible();

      await expect(row(unfinished.title)).toHaveCount(0);
    } finally {
      await page.context().close();
    }
  });

  test("switching goals on Saved lessons lists only the new goal's saves", async ({ browser }) => {
    const { finished, goal, user } = await createLearner();

    const other = await goalFixture({
      title: `Learn to cook ${randomUUID().slice(0, 6)}`,
      userId: user.id,
    });

    await Promise.all([
      planFixture({ goalId: other.id }),
      prisma.savedLesson.create({
        data: { goalId: goal.id, lessonId: finished.id, title: finished.title, userId: user.id },
      }),
    ]);

    const page = await openAs(browser, user);
    await page.setViewportSize({ height: 900, width: 1440 });

    try {
      await page.goto("/saved-lessons");

      const list = page.getByRole("list", { name: "Saved lessons" });
      const remove = list.getByRole("button", { name: `Saved ${finished.title}` });
      await expectHydrated(remove);
      await remove.click();
      await expect.poll(() => savedCount(user.id)).toBe(0);
      await expect(list.getByRole("button", { name: `Save ${finished.title}` })).toBeVisible();

      await page
        .getByRole("button", { name: /Switch goal$/u })
        .first()
        .click();

      await page.getByRole("menuitemradio", { name: other.title }).click();

      await expect(
        page.getByText("Nothing saved yet. Tap the bookmark on a lesson to keep it here."),
      ).toBeVisible();

      await expect(page.getByRole("link", { name: new RegExp(finished.title, "u") })).toHaveCount(
        0,
      );
    } finally {
      await page.context().close();
    }
  });

  test("with nothing saved the page says how to keep a lesson there", async ({ browser }) => {
    const { user } = await createLearner();
    const page = await openAs(browser, user);

    try {
      await page.goto("/saved-lessons");

      await expect(
        page.getByText("Nothing saved yet. Tap the bookmark on a lesson to keep it here."),
      ).toBeVisible();
    } finally {
      await page.context().close();
    }
  });
});
