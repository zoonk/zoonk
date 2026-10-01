import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { type Page, expect, test } from "./fixtures";
import { expectMode, setDeviceMode, showInMode } from "./learn-personas";

const GOAL_URL = /\/start\/(?<goalId>[0-9a-f-]{36})$/u;

/**
 * A published Library course of two Overview chapters with two lessons each, every lesson with
 * its own skill: what a course's outline looks like once its first band is written.
 */
async function createOutlinedCourse() {
  const id = randomUUID().slice(0, 8);
  const org = await getAiOrganization();

  const course = await courseFixture({
    isPublished: true,
    language: "en",
    organizationId: org.id,
    slug: `e2e-robotics-${id}`,
    title: `E2E Robotics ${id}`,
  });

  const chapters = await Promise.all(
    ["What robots are made of", "How robots decide"].map(async (title, position) => {
      const chapter = await libraryChapterFixture({
        homeCourseId: course.id,
        level: "overview",
        slug: `chapter-${position}-${id}`,
        title: `${title} ${id}`,
      });

      await courseChapterFixture({
        chapterId: chapter.id,
        courseId: course.id,
        level: "overview",
        position,
      });

      await Promise.all(
        [0, 1].map(async (lessonPosition) => {
          const name = `Lesson ${position + 1}.${lessonPosition + 1} ${id}`;

          const [lesson, skill] = await Promise.all([
            libraryLessonFixture({
              estimatedMinutes: 3,
              homeChapterId: chapter.id,
              level: "overview",
              slug: `lesson-${position}-${lessonPosition}-${id}`,
              title: name,
            }),
            skillFixture({ name: `Skill of ${name}` }),
          ]);

          await Promise.all([
            chapterLessonFixture({
              chapterId: chapter.id,
              lessonId: lesson.id,
              position: lessonPosition,
            }),
            lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
          ]);
        }),
      );

      return chapter;
    }),
  );

  const coursePath = `/b/${org.slug}/c/${course.slug}`;

  return { chapterPath: `${coursePath}/ch/${chapters[1]?.slug}`, chapters, course, coursePath, id };
}

/** The lessons of the goal's plan, in the order the plan teaches them. */
async function readPlanLessons(goalId: string) {
  const items = await prisma.planItem.findMany({
    include: { lesson: true },
    orderBy: { position: "asc" },
    where: { kind: "lesson", plan: { goalId } },
  });

  return items.map((item) => item.lesson?.title);
}

/** Presses the start button in the page's first screen (the one the phone's bar repeats). */
async function startFromHero(page: Page, { name, start }: { name: string; start: string }) {
  await page.getByRole("region", { name }).getByRole("button", { name: start }).click();
}

async function readGoalId(page: Page): Promise<string> {
  await expect(page).toHaveURL(GOAL_URL);
  return GOAL_URL.exec(new URL(page.url()).pathname)?.groups?.goalId ?? "";
}

test.describe("Starting a course from its page", () => {
  test("creates nothing until pressed, then asks only what onboarding still needs, with the course as the goal", async ({
    page,
  }) => {
    const { course, coursePath } = await createOutlinedCourse();
    await setDeviceMode(page.context(), "focus");

    await page.goto(`/start/course/${course.id}`);

    await expect(page.getByRole("heading", { level: 1, name: course.title })).toBeVisible();
    await expectMode(page, "focus");
    await expect(prisma.goal.count({ where: { primaryCourseId: course.id } })).resolves.toBe(0);

    await page.getByRole("button", { name: "Start this course" }).click();

    const goalId = await readGoalId(page);
    await expectMode(page, "focus");

    // No goal to type, nothing to confirm: the first screen is the learner's level in the course.
    const level = "How much do you already know?";
    await expect(page.getByRole("heading", { name: level })).toBeVisible();
    await expect(page.getByRole("main").getByText(course.title, { exact: true })).toBeVisible();
    await expectAccessibleScreen(page, level);

    await expect(page.getByRole("textbox", { name: "Your goal" })).toBeHidden();
    await expect(page.getByRole("heading", { name: "Here's what I understood:" })).toBeHidden();

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goalId } })).resolves.toMatchObject({
      details: { courseStart: { chapterId: null } },
      kind: "learn",
      primaryCourseId: course.id,
      title: course.title,
    });

    // Starting it again from the course's page brings the learner back to the same goal.
    await page.goto(coursePath);
    await startFromHero(page, { name: course.title, start: "Start this course" });

    await expect(page).toHaveURL(new RegExp(`/start/${goalId}$`, "u"));
  });

  test("starts the plan at a chapter from the chapter's page, in Fun", async ({ page }) => {
    const { chapterPath, chapters, id } = await createOutlinedCourse();
    await setDeviceMode(page.context(), "fun");

    await page.goto(chapterPath);
    await startFromHero(page, { name: chapters[1]?.title ?? "", start: "Start the chapter" });

    const goalId = await readGoalId(page);

    // The learner chose where to begin: only their time is left to ask.
    const schedule = "How much time can you study each day?";
    await expect(page.getByRole("heading", { name: schedule })).toBeVisible();
    await expectMode(page, "fun");
    await expectAccessibleScreen(page, schedule);

    const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
    expect(goal.details).toStrictEqual({ courseStart: { chapterId: chapters[1]?.id } });

    await expect(readPlanLessons(goalId)).resolves.toStrictEqual([
      `Lesson 2.1 ${id}`,
      `Lesson 2.2 ${id}`,
    ]);
  });

  test("a free learner following another goal is told why the course didn't start", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const [{ course }] = await Promise.all([
      createOutlinedCourse(),
      goalFixture({ userId: noProgressUser.id }),
      showInMode(page.context(), { mode: "fun", userId: noProgressUser.id }),
    ]);

    await page.goto(`/start/course/${course.id}`);
    await expectMode(page, "fun");

    await page.getByRole("button", { name: "Start this course" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "The free plan follows one goal at a time." }),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "Get Plus" })).toBeVisible();

    await expect(
      prisma.goal.count({ where: { primaryCourseId: course.id, userId: noProgressUser.id } }),
    ).resolves.toBe(0);
  });
});
