import { CURRENT_CURRICULUM_VERSION } from "@zoonk/core/courses/learning-plan-contract";
import { prisma } from "@zoonk/db";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { chapterSentenceFixture, sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { type Page, expect, test } from "./fixtures";

async function languageCourse() {
  const organization = await getAiOrganization();

  const course = await courseFixture({
    curriculumVersion: CURRENT_CURRICULUM_VERSION,
    format: "language",
    isPublished: true,
    organizationId: organization.id,
    targetLanguage: "de",
  });

  const [beginner, advanced] = await Promise.all([
    chapterFixture({
      courseId: course.id,
      isPublished: true,
      level: "a1",
      organizationId: organization.id,
      position: 0,
      title: "First introductions",
    }),
    chapterFixture({
      courseId: course.id,
      isPublished: true,
      level: "b2",
      organizationId: organization.id,
      position: 1,
      title: "Discussing an idea",
    }),
  ]);

  const [reading, listening] = await Promise.all([
    lessonFixture({
      chapterId: advanced.id,
      isPublished: true,
      kind: "reading",
      organizationId: organization.id,
      position: 0,
      title: "Read different opinions",
    }),
    lessonFixture({
      chapterId: advanced.id,
      isPublished: true,
      kind: "listening",
      organizationId: organization.id,
      position: 1,
      title: "Listen to different opinions",
    }),
  ]);

  const sentence = await sentenceFixture({
    organizationId: organization.id,
    sentence: `Anders-${reading.id}`,
    targetLanguage: "de",
  });

  const chapterSentence = await chapterSentenceFixture({
    sentenceId: sentence.id,
    sourceLessonId: reading.id,
    translation: "Differently",
  });

  await Promise.all([
    stepFixture({
      chapterSentenceId: chapterSentence.id,
      content: {},
      isPublished: true,
      kind: "reading",
      lessonId: reading.id,
      sentenceId: sentence.id,
    }),
    stepFixture({ isPublished: true, lessonId: listening.id }),
  ]);

  const href = `/b/ai/c/${course.slug}`;
  return { advanced, beginner, course, href, listening, reading };
}

async function chooseB2({
  page,
  scenario,
}: {
  page: Page;
  scenario: Awaited<ReturnType<typeof languageCourse>>;
}) {
  await page.goto(`${scenario.href}/start`);
  await page.getByRole("radio", { exact: false, name: "B2 · Confident conversations" }).check();
  await page.getByRole("button", { exact: true, name: "Start learning" }).click();

  await expect(page).toHaveURL(
    `${scenario.href}/ch/${scenario.advanced.slug}/l/${scenario.reading.slug}`,
  );

  await expect(page.getByText("Differently", { exact: true })).toBeVisible();
}

test("guests can start at a generated B2 lesson without signing in or generating", async ({
  page,
}) => {
  const scenario = await languageCourse();

  const introduction = await lessonFixture({
    chapterId: scenario.beginner.id,
    isPublished: true,
    kind: "explanation",
    organizationId: scenario.course.organizationId,
  });

  await stepFixture({ isPublished: true, lessonId: introduction.id });
  await chooseB2({ page, scenario });
  await page.getByRole("group", { name: "Word bank" }).getByRole("button").click();
  await page.getByRole("button", { exact: true, name: "Check" }).click();
  await page.getByRole("button", { exact: true, name: "Continue" }).click();

  await expect(page.getByRole("link", { exact: true, name: "Next" })).toHaveAttribute(
    "href",
    `${scenario.href}/ch/${scenario.advanced.slug}/l/${scenario.listening.slug}`,
  );

  expect(await prisma.courseLearningPlan.count({ where: { courseId: scenario.course.id } })).toBe(
    0,
  );

  expect(
    await prisma.chapterGenerationGrant.count({ where: { chapterId: scenario.advanced.id } }),
  ).toBe(0);
});

test("a free learner can start at B2 and revise course preferences without changing level or progress", async ({
  userWithoutProgress: page,
  noProgressUser,
}, testInfo) => {
  const scenario = await languageCourse();
  await page.setViewportSize({ height: 844, width: 390 });

  const previousLesson = await lessonFixture({
    chapterId: scenario.beginner.id,
    isPublished: true,
    kind: "vocabulary",
    organizationId: scenario.course.organizationId,
  });

  const previousProgress = await lessonProgressFixture({
    completedAt: new Date(),
    durationSeconds: 90,
    lessonId: previousLesson.id,
    userId: noProgressUser.id,
  });

  await chooseB2({ page, scenario });
  await page.goto(`${scenario.href}/preferences`);
  await page.getByRole("radio", { exact: true, name: "10 minutes" }).check();
  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  await page.getByRole("radio", { exact: false, name: "Choose activities" }).check();
  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  await page.getByRole("checkbox", { exact: false, name: "Listening" }).uncheck();
  await page.getByRole("button", { exact: true, name: "Back" }).click();
  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  await expect(page.getByRole("checkbox", { exact: false, name: "Listening" })).not.toBeChecked();
  await page.evaluate(() => window.scrollTo({ behavior: "instant", top: 0 }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  await page.screenshot({
    fullPage: false,
    path: testInfo.outputPath("preferences-mobile-viewport.png"),
  });

  await page.screenshot({ fullPage: true, path: testInfo.outputPath("preferences-mobile.png") });
  await page.getByRole("button", { exact: true, name: "Save changes" }).click();
  await expect(page).toHaveURL(`${scenario.href}?edition=original`);
  await expect(page.getByRole("heading", { name: /^B2 ·/u })).toBeVisible();
  await expect(page.getByRole("link", { name: /First introductions/u })).toHaveCount(0);

  const saved = await prisma.courseLearningPlan.findUniqueOrThrow({
    where: { userCoursePlan: { courseId: scenario.course.id, userId: noProgressUser.id } },
  });

  expect(saved).toMatchObject({
    chapterIds: [scenario.advanced.id],
    dailyMinutes: 10,
    hiddenLessonKinds: ["listening"],
    startingLevel: "b2",
  });

  expect(await prisma.lessonProgress.findUnique({ where: { id: previousProgress.id } })).toEqual(
    previousProgress,
  );

  await page.goto(`${scenario.href}/ch/${scenario.advanced.slug}`);
  await expect(page.getByRole("link", { name: /Read different opinions/u })).toBeVisible();
  await expect(page.getByRole("link", { name: /Listen to different opinions/u })).toHaveCount(0);
  await page.goto(`${scenario.href}?edition=original&curriculum=full`);
  await page.getByRole("link", { name: /Discussing an idea/u }).click();
  await expect(page).toHaveURL(`${scenario.href}/ch/${scenario.advanced.slug}?view=curriculum`);
  await expect(page.getByRole("link", { name: /Listen to different opinions/u })).toBeVisible();

  await page.goto(`${scenario.href}/preferences`);
  await expect(page.getByRole("radio", { exact: true, name: "10 minutes" })).toBeChecked();
  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  await expect(page.getByRole("radio", { exact: false, name: "Choose activities" })).toBeChecked();
  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  await expect(page.getByRole("checkbox", { exact: false, name: "Listening" })).not.toBeChecked();
});

test("a paid learner uses the same non-beginner path without spending a grant on existing content", async ({
  subscriberPage: page,
  subscriberUser,
}) => {
  const scenario = await languageCourse();
  await chooseB2({ page, scenario });

  const saved = await prisma.courseLearningPlan.findUniqueOrThrow({
    where: { userCoursePlan: { courseId: scenario.course.id, userId: subscriberUser.id } },
  });

  expect(saved).toMatchObject({ chapterIds: [scenario.advanced.id], startingLevel: "b2" });

  expect(
    await prisma.chapterGenerationGrant.count({ where: { chapterId: scenario.advanced.id } }),
  ).toBe(0);
});
