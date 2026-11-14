import { randomUUID } from "node:crypto";
import { PROFILE_QUESTIONS } from "@zoonk/core/profile/questions/contract";
import { prisma } from "@zoonk/db";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  courseBandsFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { startCourseWithLevel } from "./course-start";
import { type Page, expect, test } from "./fixtures";

const GOAL_URL = /\/start\/(?<goalId>[0-9a-f-]{36})$/u;

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

  await Promise.all(
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
    }),
  );

  await courseBandsFixture({
    courseId: course.id,
    levels: ["beginner", "intermediate", "advanced"],
  });

  return { course, coursePath: `/b/${org.slug}/c/${course.slug}` };
}

async function startFromHero(
  page: Page,
  { link = "Build my plan", name }: { link?: string; name: string },
) {
  await page.getByRole("region", { name }).getByRole("link", { name: link }).click();
}

async function readGoalId(page: Page): Promise<string> {
  await expect(page).toHaveURL(GOAL_URL);
  return GOAL_URL.exec(new URL(page.url()).pathname)?.groups?.goalId ?? "";
}

test.describe("Starting a course from its page", () => {
  test("asks the level before anything exists, then creates the goal on Start and asks only what's left", async ({
    page,
  }) => {
    const { course, coursePath } = await createOutlinedCourse();

    await page.goto(coursePath);
    await startFromHero(page, { name: course.title });
    await expect(page).toHaveURL(new RegExp(`/start/course/${course.id}\\?minutes=15$`, "u"));

    const level = "How much do you already know?";
    await expect(page.getByRole("heading", { level: 1, name: level })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "I want to" })).toBeHidden();
    await expect(page.getByRole("heading", { name: "Here's what I understood" })).toBeHidden();

    await expect(prisma.goal.count({ where: { primaryCourseId: course.id } })).resolves.toBe(0);
    const session = await page.request.get("/api/auth/get-session");
    await expect(session.json()).resolves.toBeNull();

    await startCourseWithLevel(page);
    const goalId = await readGoalId(page);

    await expect(
      page.getByRole("heading", { name: "Is there a date you're aiming for?" }),
    ).toBeVisible();

    const beforeLeaving = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
    await page.goto("/");
    await expect(page).toHaveURL(/\/today$/u);
    const resume = page.getByRole("link", { name: /^Continue\b/u });
    await expect(resume).toHaveAttribute("href", `/start/${goalId}`);
    await expect(prisma.studySession.count({ where: { goalId } })).resolves.toBe(0);

    await resume.click();
    await expect(page).toHaveURL(new RegExp(`/start/${goalId}$`, "u"));

    await expect(
      page.getByRole("heading", { name: "Is there a date you're aiming for?" }),
    ).toBeVisible();

    await expect(page.getByRole("heading", { name: level })).toBeHidden();

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goalId } })).resolves.toMatchObject({
      dailyMinutes: beforeLeaving.dailyMinutes,
      details: beforeLeaving.details,
      targetDate: beforeLeaving.targetDate,
    });

    const targetDate = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    await page.getByLabel("Date", { exact: true }).fill(targetDate);
    await page.getByRole("button", { exact: true, name: "Continue" }).click();
    await page.getByRole("button", { exact: true, name: "Skip all" }).click();
    await expect(page.getByRole("heading", { name: "Choose your buddy" })).toBeVisible();

    await expect(page.getByRole("heading", { name: level })).toBeHidden();

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goalId } })).resolves.toMatchObject({
      details: {
        answered: ["level", "targetDate", ...PROFILE_QUESTIONS],
        courseStart: { chapterId: null },
        level: "basic",
      },
      kind: "learn",
      primaryCourseId: course.id,
      targetDate: new Date(`${targetDate}T00:00:00.000Z`),
      title: course.title,
    });

    await page.goto(coursePath);
    await startFromHero(page, { link: "Continue your plan", name: course.title });

    await expect(page).toHaveURL(new RegExp(`/start/${goalId}$`, "u"));
  });

  test("a free learner who started every new goal they can this month sees when more come back", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const { course } = await createOutlinedCourse();
    const firstGoal = new Date(Date.now() - 10 * 86_400_000);
    const moreOn = new Date(firstGoal.getTime() + 30 * 86_400_000);

    await usageRecordsFixture({
      count: 10,
      createdAt: firstGoal,
      kind: "goal",
      userId: noProgressUser.id,
    });

    await page.goto(`/start/course/${course.id}?minutes=15`);

    await expect(page.getByText("You've started all the new goals you can")).toBeVisible();

    await expect(
      page.getByText(
        `More on ${moreOn.toLocaleDateString("en-US", { day: "numeric", month: "long" })}, or subscribe to keep going.`,
      ),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "Subscribe" })).toHaveAttribute(
      "href",
      "/subscription",
    );

    await expect(page.getByRole("link", { name: "Go to your Plan" })).toBeHidden();
    await expect(page.getByRole("button", { name: /Build my plan/u })).toBeHidden();
    await expect(prisma.goal.count({ where: { primaryCourseId: course.id } })).resolves.toBe(0);
  });
});
