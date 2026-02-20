import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { createE2EUser, getAiOrganization } from "@zoonk/e2e/helpers";
import { activityFixture, activityProgressFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expect, test } from "./fixtures";

async function createCourseWithThreeActivities() {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-cl-reval-course-${uniqueId}`,
    title: `E2E CL Reval Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-cl-reval-chapter-${uniqueId}`,
    title: `E2E CL Reval Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E continue learning revalidation lesson ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-cl-reval-lesson-${uniqueId}`,
    title: `E2E CL Reval Lesson ${uniqueId}`,
  });

  // Activity 0: will be pre-completed by the user
  const activity0 = await activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "background",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `Completed Act ${uniqueId}`,
  });

  // Activity 1: the current "next" activity (static, user will complete it in the test)
  const activity1 = await activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "background",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 1,
    title: `Current Next ${uniqueId}`,
  });

  // Activity 2: will become "next" after completing activity 1
  const activity2 = await activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "background",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 2,
    title: `After Next ${uniqueId}`,
  });

  // Add a static step to activity 1 so we can complete it
  await stepFixture({
    activityId: activity1.id,
    content: { text: `Step body ${uniqueId}`, title: `Step Title ${uniqueId}`, variant: "text" },
    isPublished: true,
    position: 0,
  });

  const activityUrl = `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/1`;

  return { activity0, activity1, activity2, activityUrl, course, uniqueId };
}

test.describe("Continue Learning Revalidation", () => {
  test("home page updates continue learning after completing an activity", async ({
    baseURL,
    browser,
  }) => {
    const user = await createE2EUser(baseURL!);
    const browserContext = await browser.newContext({ storageState: user.storageState });
    const page = await browserContext.newPage();
    const { activity0, course, uniqueId } = await createCourseWithThreeActivities();

    // Pre-complete activity 0 so getContinueLearning returns this course with activity 1 as "next"
    await Promise.all([
      activityProgressFixture({
        activityId: activity0.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: user.id,
      }),
      prisma.courseUser.create({ data: { courseId: course.id, userId: user.id } }),
    ]);

    // 1. Navigate to home page (full load)
    await page.goto("/");
    const nextLink = page.getByRole("link", {
      name: new RegExp(`Next:.*Current Next ${uniqueId}`),
    });
    await expect(nextLink.first()).toBeVisible();

    // 2. Click the continue learning card link (client-side navigation)
    await nextLink.first().click();
    await page.waitForURL(new RegExp(`/a/1`));
    await page.waitForLoadState("networkidle");

    // 3. Complete the static activity
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.getByText(/completed/i)).toBeVisible();

    // 4. Click "Back to Lesson" (client-side navigation)
    await page.getByRole("link", { name: /back to lesson/i }).click();
    await page.waitForURL(new RegExp(`e2e-cl-reval-lesson-${uniqueId}`));

    // 5. Click the Home link in the navbar (client-side navigation — Router Cache)
    await page.getByRole("link", { name: /home page/i }).click();
    await page.waitForURL(/\/$/);

    // 6. Continue learning should show the NEW next activity, not the old one
    await expect(page.getByText(new RegExp(`Next:.*After Next ${uniqueId}`)).first()).toBeVisible();

    await browserContext.close();
  });
});
