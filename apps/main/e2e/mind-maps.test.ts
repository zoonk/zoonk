import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { chapterLessonFixture, lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { expect, test } from "./fixtures";
import { openAs } from "./study-day";

/** A one-pixel picture, so the map has a thumbnail without a file to serve. */
const PICTURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HJ4BAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const STRUCTURE = {
  branches: ["Nucleus", "Electron", "Empty space"].map((title) => ({
    drawing: title,
    explanation: `What ${title} means`,
    points: [title],
    title,
  })),
  centralIdea: "An atom is mostly empty",
  comparison: null,
  summary: "A tiny nucleus with electrons around it",
  title: "Inside the atom",
};

async function createChapter(goalSuffix: string, position: number) {
  const suffix = `${goalSuffix}-${position}`;

  const [chapter, skill, { lesson }] = await Promise.all([
    libraryChapterFixture({ title: `Inside the atom ${suffix}` }),
    skillFixture({ name: `Atoms ${suffix}` }),
    playableLessonFixture({ lesson: { title: "An almost empty atom" }, steps: ["explanation"] }),
  ]);

  await Promise.all([
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
    lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    prisma.lesson.update({ data: { homeChapterId: chapter.id }, where: { id: lesson.id } }),
  ]);

  return { chapter, lessonId: lesson.id, skillId: skill.id };
}

/** A learner whose plan has two chapters, each with one written lesson and no map. */
async function createLearner() {
  const user = await createE2EUser(getBaseURL());
  const suffix = randomUUID().slice(0, 6);

  const [goal, first, second] = await Promise.all([
    goalFixture({ timezone: "UTC", title: `Understand atoms ${suffix}`, userId: user.id }),
    createChapter(suffix, 1),
    createChapter(suffix, 2),
  ]);

  await Promise.all([
    planFixture({
      goalId: goal.id,
      items: [first, second].map(({ chapter, lessonId, skillId }) => ({
        chapterId: chapter.id,
        lessonId,
        skillId,
      })),
    }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  return { first, second, user };
}

/** The model's part: the API's E2E build holds a workflow's model calls, so its run never ends. */
async function drawMap(chapterId: string) {
  const map = {
    imageHeight: 1,
    imageUrl: PICTURE,
    imageWidth: 1,
    status: "completed" as const,
    structure: STRUCTURE,
    thumbnailUrl: PICTURE,
  };

  await prisma.chapterMindMap.upsert({
    create: { ...map, chapterId, language: "en" },
    update: map,
    where: { chapterId },
  });
}

test.describe("Mind maps", () => {
  test("finishing a chapter shows its map row, which turns ready and opens the map", async ({
    browser,
  }) => {
    const { first, user } = await createLearner();
    const { chapter, lessonId } = first;
    const page = await openAs(browser, user);

    try {
      await page.goto(`/learn/${lessonId}`);
      await expect(page.getByText("A cloud, not a little ball")).toBeVisible();
      await page.getByRole("button", { name: /^Continue/u }).click();

      await expect(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

      const finished = page.getByRole("region", { name: "Chapter finished" });
      await expect(finished.getByText(chapter.title)).toBeVisible();
      await expect(finished.getByText("Drawing the mind map…")).toBeVisible();

      await drawMap(chapter.id);

      await expect(finished.getByText("Mind map ready")).toBeVisible();
      await finished.getByRole("button", { name: /Open$/u }).click();

      const viewer = page.getByRole("dialog", { name: chapter.title });

      await expect(
        viewer.getByRole("img", { name: `Mind map: ${STRUCTURE.title}. ${STRUCTURE.centralIdea}` }),
      ).toBeVisible();

      // The outline is also in a hidden description for screen readers.
      await expect(viewer.getByText(STRUCTURE.summary).filter({ visible: true })).toBeVisible();
    } finally {
      await page.context().close();
    }
  });

  test("a map saved while studying stays in Saved until the learner removes it", async ({
    browser,
  }) => {
    const { first, second, user } = await createLearner();

    await Promise.all([drawMap(first.chapter.id), drawMap(second.chapter.id)]);

    const page = await openAs(browser, user);
    const savedCount = () => prisma.savedMindMap.count({ where: { userId: user.id } });

    try {
      await page.goto("/mind-maps");
      await page.getByRole("link", { name: new RegExp(second.chapter.title, "u") }).click();

      await expect(
        page.getByRole("heading", { level: 1, name: second.chapter.title }),
      ).toBeVisible();

      await page.getByRole("button", { exact: true, name: "Save" }).click();
      await expect(page.getByRole("button", { exact: true, name: "Saved" })).toBeVisible();
      await expect.poll(savedCount).toBe(1);

      await page.getByRole("button", { name: "Previous map" }).click();

      await expect(
        page.getByRole("heading", { level: 1, name: first.chapter.title }),
      ).toBeVisible();

      await page.getByRole("link", { name: "Leave" }).click();

      // The router keeps the Study page it left alive; opening a map again starts on that map.
      await page.getByRole("link", { name: new RegExp(second.chapter.title, "u") }).click();

      await expect(
        page.getByRole("heading", { level: 1, name: second.chapter.title }),
      ).toBeVisible();

      await page.getByRole("link", { name: "Leave" }).click();

      await page
        .getByRole("navigation", { name: "Mind maps" })
        .getByRole("link", { name: /^Saved/u })
        .click();

      const saved = page.getByRole("list", { name: "Saved maps" });
      const savedMap = saved.getByRole("link", { name: new RegExp(second.chapter.title, "u") });

      await expect(savedMap).toBeVisible();
      await saved.getByRole("button", { name: "Saved" }).click();

      await expect(savedMap).toBeHidden();
      await expect.poll(savedCount).toBe(0);
    } finally {
      await page.context().close();
    }
  });

  test("creating every chapter map starts them and the page shows each as it turns ready", async ({
    browser,
  }) => {
    const { first, user } = await createLearner();
    const page = await openAs(browser, user);

    try {
      await page.goto("/mind-maps");
      await page.getByRole("button", { name: "Create 2 chapter maps" }).click();
      await expect(page.getByText(/2 on the way/u)).toBeVisible();

      await drawMap(first.chapter.id);

      await expect(
        page.getByRole("link", { name: new RegExp(first.chapter.title, "u") }),
      ).toBeVisible({ timeout: 15_000 });

      await expect(page.getByText(/1 on the way/u)).toBeVisible();
    } finally {
      await page.context().close();
    }
  });

  test("a free learner out of maps for the day sees why, and no chapter offers to create one", async ({
    browser,
  }) => {
    const { first, second, user } = await createLearner();

    await Promise.all([
      drawMap(first.chapter.id),
      prisma.lesson.update({ data: { contentStatus: "pending" }, where: { id: second.lessonId } }),
      usageRecordsFixture({ count: 3, createdAt: new Date(), kind: "mindMap", userId: user.id }),
    ]);

    const page = await openAs(browser, user);
    const notMade = page.getByRole("region", { name: "Not made yet" });

    try {
      await page.goto("/mind-maps");
      await expect(notMade.getByText(/^That's all the new mind maps for today/u)).toBeVisible();
      await expect(notMade.getByRole("link", { name: "See Plus" })).toBeVisible();

      await notMade.getByRole("button", { name: /^Show chapters/u }).click();

      const row = notMade.getByRole("listitem").filter({ hasText: second.chapter.title });
      await expect(row.getByText("1 lesson to write", { exact: true })).toBeVisible();
      await expect(row.getByRole("button", { name: "Create" })).toBeHidden();

      await expect(
        notMade.getByText("Writing lessons counts toward your free lessons."),
      ).toBeHidden();
    } finally {
      await page.context().close();
    }
  });

  test("a request that didn't reach the server says so until the page's next read comes through", async ({
    browser,
  }) => {
    const { first, second, user } = await createLearner();
    const page = await openAs(browser, user);
    const row = (title: string) => page.getByRole("listitem").filter({ hasText: title });
    const secondRow = row(second.chapter.title);
    const message = "We couldn't reach the server. Check your connection.";
    const unreachable = page.getByText(message, { exact: true }).filter({ visible: true });

    try {
      await page.goto("/mind-maps");
      await page.getByRole("button", { name: /^Show chapters/u }).click();
      await row(first.chapter.title).getByRole("button", { name: "Create" }).click();
      await expect(page.getByText(/1 on the way/u)).toBeVisible();

      // The button counts only what's left to start once the first map is on its way.
      const createRest = page.getByRole("button", { name: "Create 1 chapter map" });
      await expect(createRest).toBeVisible();

      await page.route("**/generations", (route) => route.abort());
      await secondRow.getByRole("button", { name: "Create" }).click();
      await createRest.click();

      // Both requests say so: the row's in the row, the button's under the button.
      await expect(secondRow.getByRole("button", { name: "Try again" })).toBeVisible();
      await expect(unreachable).toHaveCount(2);

      // The first map is still drawing, so the page reads the list again within a few seconds.
      await expect(unreachable).toHaveCount(0, { timeout: 15_000 });
      await expect(secondRow.getByRole("button", { name: "Create" })).toBeVisible();
    } finally {
      await page.context().close();
    }
  });
});
