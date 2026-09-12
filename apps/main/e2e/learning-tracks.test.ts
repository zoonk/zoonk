import { CURRENT_CURRICULUM_VERSION } from "@zoonk/core/courses/learning-plan-contract";
import { prisma } from "@zoonk/db";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { coursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expect, test } from "./fixtures";
import { privateLearningCourse } from "./private-learning-fixtures";

async function reusableTrackCourse(title: string) {
  const organization = await getAiOrganization();

  const course = await courseFixture({
    curriculumVersion: CURRENT_CURRICULUM_VERSION,
    isPublished: true,
    organizationId: organization.id,
    title,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    level: "overview",
    organizationId: organization.id,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    isPublished: true,
    kind: "explanation",
    organizationId: organization.id,
  });

  await stepFixture({
    content: {
      text: `A useful first idea from ${title}.`,
      title: "One useful idea",
      variant: "text",
    },
    isPublished: true,
    lessonId: lesson.id,
  });

  return { chapter, course, lesson };
}

test("a Track asks for each new reusable course path before starting and preserves the grouping", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const [first, second] = await Promise.all([
    reusableTrackCourse("Track physics"),
    reusableTrackCourse("Track chemistry"),
  ]);

  const track = await prisma.track.create({
    data: {
      courses: {
        create: [
          { courseId: first.course.id, position: 0 },
          { courseId: second.course.id, position: 1 },
        ],
      },
      title: "Science at my own depth",
      userId: noProgressUser.id,
    },
  });

  await page.goto(`/tracks/${track.id}`);
  await page.getByRole("button", { exact: true, name: "Start learning" }).click();
  await expect(page).toHaveURL(`/b/ai/c/${first.course.slug}/start`);
  await page.getByRole("radio", { name: /Get an overview/u }).check();
  await page.getByRole("button", { exact: true, name: "Start learning" }).click();

  await expect(page).toHaveURL(
    `/b/ai/c/${first.course.slug}/ch/${first.chapter.slug}/l/${first.lesson.slug}`,
  );

  await expect(page.getByText("A useful first idea from Track physics.")).toBeVisible();

  expect(
    await prisma.courseLearningPlan.findFirst({
      where: { courseId: first.course.id, userId: noProgressUser.id },
    }),
  ).toMatchObject({ depth: "overview" });

  await page
    .getByRole("region", { name: "Lesson content" })
    .getByRole("button", { name: "Next step" })
    .click();

  await expect
    .poll(async () => {
      const progress = await prisma.lessonProgress.findFirst({
        where: { lessonId: first.lesson.id, userId: noProgressUser.id },
      });

      return Boolean(progress?.completedAt);
    })
    .toBe(true);

  await page.goto(`/tracks/${track.id}`);
  await page.getByRole("button", { exact: true, name: "Continue learning" }).click();
  await expect(page).toHaveURL(`/b/ai/c/${second.course.slug}/start`);
  await expect(page.getByRole("radio", { name: /Get an overview/u })).toBeVisible();
  expect(await prisma.trackCourse.count({ where: { trackId: track.id } })).toBe(2);

  expect(
    await prisma.generationQuotaClaim.count({ where: { actorKey: `user:${noProgressUser.id}` } }),
  ).toBe(0);
});

test("reorders and removes pending Track members without generating them, then resumes the remaining course", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const scenario = await privateLearningCourse(noProgressUser.id);

  const prompt = await coursePromptFixture({
    canonicalTitle: "Future astronomy",
    prompt: `Future astronomy ${scenario.course.id}`,
  });

  const track = await prisma.track.create({
    data: {
      courses: { create: { courseId: scenario.course.id, position: 0 } },
      request: {
        language: "en",
        subjects: [
          { courseId: scenario.course.id, title: scenario.course.title },
          { coursePromptId: prompt.id, title: "Future astronomy" },
        ],
      },
      title: "Family learning track",
      userId: noProgressUser.id,
    },
  });

  await page.goto("/my");
  await expect(page.getByRole("link", { name: /Family learning track/u })).toHaveCount(1);
  await expect(page.getByRole("link", { name: scenario.course.title })).toHaveCount(0);
  await page.getByRole("link", { name: /Family learning track/u }).click();
  await page.getByRole("link", { exact: true, name: "Edit track" }).click();
  await page.getByRole("button", { exact: true, name: "Move Future astronomy up" }).click();

  await expect(
    page.getByRole("button", { exact: true, name: "Move Future astronomy up" }),
  ).toBeDisabled();

  await page.getByRole("button", { exact: true, name: "Save changes" }).click();
  await expect(page).toHaveURL(`/tracks/${track.id}`);

  expect(await prisma.trackCourse.findFirstOrThrow({ where: { trackId: track.id } })).toMatchObject(
    { position: 1 },
  );

  await page.getByRole("link", { exact: true, name: "Edit track" }).click();

  await page
    .getByRole("button", { exact: true, name: "Remove Future astronomy from track" })
    .click();

  await page.getByRole("button", { exact: true, name: "Save changes" }).click();
  await expect(page).toHaveURL(`/tracks/${track.id}`);
  await expect(page.getByText("Future astronomy", { exact: true })).not.toBeVisible();

  expect(await prisma.track.findUniqueOrThrow({ where: { id: track.id } })).toMatchObject({
    request: { subjects: [{ courseId: scenario.course.id, title: scenario.course.title }] },
  });

  await page.getByRole("button", { exact: true, name: "Start learning" }).click();
  await expect(page).toHaveURL(scenario.lessonHref);

  expect(
    await prisma.generationQuotaClaim.count({ where: { actorKey: `user:${noProgressUser.id}` } }),
  ).toBe(0);
});

test("removing a private Track restores its course in My Courses and preserves earned progress", async ({
  noProgressUser,
  page: guest,
  userWithoutProgress: page,
}) => {
  const scenario = await privateLearningCourse(noProgressUser.id);

  const progress = await lessonProgressFixture({
    completedAt: new Date(),
    durationSeconds: 70,
    lessonId: scenario.lesson.id,
    userId: noProgressUser.id,
  });

  const track = await prisma.track.create({
    data: {
      courses: { create: { courseId: scenario.course.id, position: 0 } },
      title: "Private family learning",
      userId: noProgressUser.id,
    },
  });

  const denied = await guest.request.get(`/tracks/${track.id}`, { maxRedirects: 0 });
  expect(await denied.text()).not.toContain(track.title);
  await page.goto(`/tracks/${track.id}/edit`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/u);
  await page.getByRole("button", { exact: true, name: "Remove track" }).click();
  await page.getByRole("button", { exact: true, name: "Cancel" }).click();
  await expect(page.getByRole("button", { exact: true, name: "Remove track" })).toBeFocused();
  await page.getByRole("button", { exact: true, name: "Remove track" }).click();
  await page.getByRole("button", { exact: true, name: "Remove track" }).click();
  await expect(page).toHaveURL("/my");
  await expect(page.getByRole("link", { name: scenario.course.title })).toHaveCount(1);
  expect(await prisma.track.findUnique({ where: { id: track.id } })).toBeNull();

  expect(await prisma.lessonProgress.findUnique({ where: { id: progress.id } })).toMatchObject({
    durationSeconds: 70,
  });

  expect(
    await prisma.courseUser.findUnique({
      where: { courseUser: { courseId: scenario.course.id, userId: noProgressUser.id } },
    }),
  ).not.toBeNull();
});
