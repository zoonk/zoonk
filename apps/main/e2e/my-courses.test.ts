import { prisma } from "@zoonk/db";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture, courseUserFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { expect, test } from "./fixtures";

test.describe("My Courses", () => {
  test("signed-out learners are prompted to log in to track their courses", async ({ page }) => {
    await page.goto("/my");

    await expect(page.getByRole("heading", { name: /my courses/iu })).toBeVisible();
    await expect(page.getByText(/log in to track your courses/iu)).toBeVisible();

    await expect(
      page.getByText(/keep your courses and progress in one place by logging in to your account/iu),
    ).toBeVisible();

    const loginLink = page.getByRole("link", { name: /log in/iu });

    await expect(loginLink).toHaveAttribute("href", "/login?next=%2Fmy");
    await expect(page.getByText(/no courses yet/iu)).toHaveCount(0);
  });

  test("empty state starts a course from the start page", async ({ userWithoutProgress }) => {
    await userWithoutProgress.goto("/my");

    await expect(userWithoutProgress.getByRole("heading", { name: /my courses/iu })).toBeVisible();
    await expect(userWithoutProgress.getByText(/no courses yet/iu)).toBeVisible();

    const startCourseLink = userWithoutProgress.getByRole("link", { name: /start a course/iu });

    await expect(userWithoutProgress.getByRole("link", { name: /explore courses/iu })).toHaveCount(
      0,
    );

    await expect(startCourseLink).toHaveAttribute("href", "/start");

    await startCourseLink.click();

    await expect(userWithoutProgress).toHaveURL(/\/start$/u);

    await expect(
      userWithoutProgress.getByRole("heading", { name: "What's your goal?" }),
    ).toBeVisible();
  });

  test("removes a course from the list without clearing progress", async ({ baseURL, browser }) => {
    const [user, organization] = await Promise.all([
      createE2EUser(baseURL!),
      organizationFixture({ kind: "brand" }),
    ]);

    const course = await courseFixture({
      isPublished: true,
      organizationId: organization.id,
      title: `Course to remove ${user.id}`,
    });

    const chapter = await chapterFixture({ courseId: course.id, organizationId: organization.id });

    const lesson = await lessonFixture({ chapterId: chapter.id, organizationId: organization.id });

    const [, lessonProgress] = await Promise.all([
      courseUserFixture({ courseId: course.id, userId: user.id }),
      lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: lesson.id,
        userId: user.id,
      }),
    ]);

    const browserContext = await browser.newContext({ storageState: user.storageState });
    const page = await browserContext.newPage();

    await page.goto("/my");

    await expect(page.getByRole("link", { name: course.title })).toBeVisible();
    await page.getByRole("button", { name: `More options for ${course.title}` }).click();
    await page.getByRole("menuitem", { name: "Remove from My Courses" }).click();

    const confirmation = page.getByRole("alertdialog", { name: `Remove ${course.title}?` });

    await expect(confirmation).toContainText("Your progress will be kept.");
    await confirmation.getByRole("button", { name: "Remove course" }).click();
    await expect(page.getByRole("link", { name: course.title })).toHaveCount(0);

    await expect(async () => {
      const [courseUser, preservedProgress, updatedCourse] = await Promise.all([
        prisma.courseUser.findUnique({
          where: { courseUser: { courseId: course.id, userId: user.id } },
        }),
        prisma.lessonProgress.findUnique({ where: { id: lessonProgress.id } }),
        prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      ]);

      expect(courseUser).toBeNull();
      expect(preservedProgress).not.toBeNull();
      expect(updatedCourse.userCount).toBe(0);
    }).toPass({ timeout: 10_000 });

    await browserContext.close();
  });
});
