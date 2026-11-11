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

async function createLearner() {
  const user = await createE2EUser(getBaseURL());
  const suffix = randomUUID().slice(0, 6);

  const [goal, chapter, skill, { lesson }] = await Promise.all([
    goalFixture({ timezone: "UTC", title: `Understand atoms ${suffix}`, userId: user.id }),
    libraryChapterFixture({ title: `Inside the atom ${suffix}` }),
    skillFixture({ name: `Atoms ${suffix}` }),
    playableLessonFixture({ lesson: { title: "An almost empty atom" }, steps: ["explanation"] }),
  ]);

  await Promise.all([
    planFixture({
      goalId: goal.id,
      items: [{ chapterId: chapter.id, lessonId: lesson.id, skillId: skill.id }],
    }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
    lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    prisma.lesson.update({ data: { homeChapterId: chapter.id }, where: { id: lesson.id } }),
  ]);

  return { chapter, lessonId: lesson.id, user };
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
    const { chapter, lessonId, user } = await createLearner();
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
});
