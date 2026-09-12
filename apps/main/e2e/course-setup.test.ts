import { CURRENT_CURRICULUM_VERSION } from "@zoonk/core/courses/learning-plan-contract";
import { prisma } from "@zoonk/db";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expect, test } from "./fixtures";

test("an authored legacy course starts its existing teaching without unsupported path setup", async ({
  page,
}) => {
  const organization = await organizationFixture({ kind: "brand" });
  const course = await courseFixture({ isPublished: true, organizationId: organization.id });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: organization.id,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    isPublished: true,
    organizationId: organization.id,
  });

  await stepFixture({
    content: {
      text: "The author's original teaching stays available.",
      title: "An authored idea",
      variant: "text",
    },
    isPublished: true,
    lessonId: lesson.id,
  });

  const href = `/b/${organization.slug}/c/${course.slug}`;
  const lessonHref = `${href}/ch/${chapter.slug}/l/${lesson.slug}`;
  await page.goto(href);

  await expect(page.getByRole("link", { exact: true, name: "Start" })).toHaveAttribute(
    "href",
    lessonHref,
  );

  await expect(page.getByRole("link", { name: "Change learning path" })).toHaveCount(0);
  await page.getByRole("link", { exact: true, name: "Start" }).click();
  await expect(page.getByRole("heading", { name: "An authored idea" })).toBeVisible();
  await page.goto(`${href}/start`);
  await expect(page).toHaveURL(lessonHref);
  await expect(page.getByRole("heading", { name: "An authored idea" })).toBeVisible();
  expect(await prisma.courseLearningPlan.count({ where: { courseId: course.id } })).toBe(0);
  expect(await prisma.generationQuotaClaim.count({ where: { targetId: course.id } })).toBe(0);
});

test("a guest overview continues through its chapters and stops before the full curriculum", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  const organization = await getAiOrganization();

  const course = await courseFixture({
    curriculumVersion: CURRENT_CURRICULUM_VERSION,
    isPublished: true,
    organizationId: organization.id,
  });

  const lessons = await Promise.all(
    (["overview", "overview", "overview", "basic"] as const).map(async (level, position) => {
      const chapter = await chapterFixture({
        courseId: course.id,
        isPublished: true,
        level,
        organizationId: organization.id,
        position,
      });

      const lesson = await lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: organization.id,
      });

      await stepFixture({
        content: {
          text: "One useful idea to take away.",
          title: `Overview idea ${position + 1}`,
          variant: "text",
        },
        isPublished: true,
        lessonId: lesson.id,
      });

      return `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`;
    }),
  );

  await page.goto(`/b/ai/c/${course.slug}/start`);
  await page.getByRole("radio", { name: "Get an overview" }).check();
  await page.getByRole("button", { exact: true, name: "Start learning" }).click();

  // Each lesson navigation depends on completing the previous lesson in this browser.
  /* oxlint-disable eslint/no-await-in-loop */
  for (const [index, href] of lessons.slice(0, 3).entries()) {
    await expect(page).toHaveURL(href);
    await expect(page.getByRole("heading", { name: `Overview idea ${index + 1}` })).toBeVisible();
    await page.getByRole("button", { exact: true, name: "Next" }).click();

    if (index < 2) {
      await page.getByRole("link", { exact: true, name: "Next" }).click();
    }
  }
  /* oxlint-enable eslint/no-await-in-loop */

  await expect(page.getByRole("link", { exact: true, name: "Next" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Log in to save progress" })).toBeVisible();
  expect(await prisma.courseLearningPlan.count({ where: { courseId: course.id } })).toBe(0);
});

test("preserves a concrete learning goal and starting level across branching and reload", async ({
  page,
}) => {
  const organization = await getAiOrganization();
  const course = await courseFixture({ isPublished: true, organizationId: organization.id });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto(`/b/ai/c/${course.slug}/start`);

  await page.getByRole("radio", { exact: false, name: "Work toward a goal" }).check();
  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  await page.getByRole("radio", { exact: false, name: "Make something" }).check();
  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  const project = "Build a bakery website with AI tools";
  await page.getByRole("textbox", { name: "What would you like to make?" }).fill(project);
  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  await page.getByRole("radio", { exact: false, name: "I know the basics" }).check();

  await page.reload();
  await expect(page.getByRole("radio", { exact: false, name: "Work toward a goal" })).toBeChecked();
  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  await expect(page.getByRole("radio", { exact: false, name: "Make something" })).toBeChecked();
  await page.getByRole("button", { exact: true, name: "Continue" }).click();

  await expect(page.getByRole("textbox", { name: "What would you like to make?" })).toHaveValue(
    project,
  );

  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  await expect(page.getByRole("radio", { exact: false, name: "I know the basics" })).toBeChecked();

  await page.getByRole("button", { exact: true, name: "Back" }).click();
  await page.getByRole("button", { exact: true, name: "Back" }).click();
  await page.getByRole("button", { exact: true, name: "Back" }).click();
  await page.getByRole("radio", { exact: false, name: "Get an overview" }).check();
  await expect(page.getByRole("button", { exact: true, name: "Start learning" })).toBeVisible();
  await page.getByRole("radio", { exact: false, name: "Work toward a goal" }).check();
  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  await page.getByRole("button", { exact: true, name: "Continue" }).click();

  await expect(page.getByRole("textbox", { name: "What would you like to make?" })).toHaveValue(
    project,
  );

  expect(errors).toEqual([]);
});

test("asks no extra project question for an already specific custom goal", async ({ page }) => {
  const organization = await getAiOrganization();
  const course = await courseFixture({ isPublished: true, organizationId: organization.id });
  await page.goto(`/b/ai/c/${course.slug}/start`);
  await page.getByRole("radio", { exact: false, name: "Work toward a goal" }).check();
  await page.getByRole("button", { exact: true, name: "Continue" }).click();

  await page
    .getByRole("textbox", { name: "Another goal" })
    .fill("Understand my telescope's optics");

  await page.getByRole("button", { exact: true, name: "Continue" }).click();

  await expect(
    page.getByRole("group", { name: "How familiar are you with this subject?" }),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByRole("radio", { exact: false, name: "Work toward a goal" })).toBeChecked();
  await page.getByRole("button", { exact: true, name: "Continue" }).click();

  await expect(page.getByRole("textbox", { name: "Another goal" })).toHaveValue(
    "Understand my telescope's optics",
  );
});

test("a failed setup request keeps the custom goal and starting level available to retry", async ({
  page,
}) => {
  const organization = await getAiOrganization();
  const course = await courseFixture({ isPublished: true, organizationId: organization.id });
  const href = `/b/ai/c/${course.slug}/start`;
  await page.goto(href);
  await page.getByRole("radio", { exact: false, name: "Work toward a goal" }).check();
  await page.getByRole("button", { exact: true, name: "Continue" }).click();

  await page
    .getByRole("textbox", { name: "Another goal" })
    .fill("Understand my telescope's optics");

  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  await page.getByRole("radio", { exact: false, name: "I know the basics" }).check();

  await page.route(`**${href}`, async (route) => {
    if (route.request().headers()["next-action"]) {
      await route.abort("failed");
      return;
    }

    await route.continue();
  });

  await page.getByRole("button", { exact: true, name: "Start learning" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "We couldn't save your choices" }),
  ).toBeVisible();

  await expect(page.getByRole("radio", { exact: false, name: "I know the basics" })).toBeChecked();
  await page.getByRole("button", { exact: true, name: "Back" }).click();

  await expect(page.getByRole("textbox", { name: "Another goal" })).toHaveValue(
    "Understand my telescope's optics",
  );

  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  await page.unroute(`**${href}`);

  await page.route("**/auth/login**", (route) =>
    route.fulfill({ body: "Auth service", contentType: "text/html" }),
  );

  const authRequest = page.waitForRequest("**/auth/login**");
  await page.getByRole("button", { exact: true, name: "Start learning" }).click();
  const request = await authRequest;
  await expect(page.getByText("Auth service", { exact: true })).toBeVisible();
  const authUrl = new URL(request.url());
  const callbackUrl = new URL(authUrl.searchParams.get("redirectTo") ?? "");
  expect(callbackUrl.searchParams.get("next")).toBe(href);
});
