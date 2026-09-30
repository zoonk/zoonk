import { randomUUID } from "node:crypto";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
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
      userWithoutProgress.getByRole("heading", { name: "What do you want to achieve?" }),
    ).toBeVisible();
  });

  test("lists the courses of the learner's goals and started lessons", async ({
    baseURL,
    browser,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);

    const [user, started] = await Promise.all([
      createE2EUser(baseURL!),
      catalogCourseFixture({ lessonCounts: [1], title: `Started course ${uniqueId}` }),
    ]);

    const privateCourse = await courseFixture({
      title: `My own course ${uniqueId}`,
      userId: user.id,
      visibility: "private",
    });

    await Promise.all([
      goalFixture({
        primaryCourseId: privateCourse.id,
        updatedAt: new Date(Date.now() - 60_000),
        userId: user.id,
      }),
      learningEventFixture({
        contentIds: { chapterId: started.chapters[0]!.id, lessonId: started.lessons[0]![0]!.id },
        userId: user.id,
      }),
    ]);

    const browserContext = await browser.newContext({ storageState: user.storageState });
    const page = await browserContext.newPage();

    await page.goto("/my");

    const startedLink = page.getByRole("link", { name: started.course.title });
    const privateLink = page.getByRole("link", { name: privateCourse.title });

    await expect(startedLink).toHaveAttribute(
      "href",
      `/b/${started.organization.slug}/c/${started.course.slug}`,
    );

    await expect(privateLink).toHaveAttribute("href", "/plan");
    await expect(page.getByRole("button", { name: /more options/iu })).toHaveCount(0);

    await startedLink.click();

    await expect(page.getByRole("heading", { level: 1, name: started.course.title })).toBeVisible();

    await browserContext.close();
  });

  test("a language course shows the flag of the variety it teaches", async ({
    baseURL,
    browser,
  }) => {
    const user = await createE2EUser(baseURL!);

    const course = await courseFixture({
      targetLanguage: "es",
      title: `Spanish course ${randomUUID().slice(0, 8)}`,
      userId: user.id,
      visibility: "private",
    });

    await goalFixture({
      kind: "language",
      primaryCourseId: course.id,
      targetLanguage: "es",
      userId: user.id,
    });

    const browserContext = await browser.newContext({ storageState: user.storageState });
    const page = await browserContext.newPage();

    await page.goto("/my");

    const link = page.getByRole("link", { name: new RegExp(course.title, "u") });
    await expect(link.getByRole("img", { name: "European Spanish" })).toBeVisible();

    await browserContext.close();
  });
});
