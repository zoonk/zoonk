import { randomUUID } from "node:crypto";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { expect, test } from "./fixtures";

async function publishedCourse(attrs: {
  language: string;
  targetLanguage?: string;
  title: string;
}) {
  const org = await getAiOrganization();

  const course = await courseFixture({
    ...attrs,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-course-detail-${randomUUID().slice(0, 8)}`,
  });

  return { course, path: `/b/${org.slug}/c/${course.slug}` };
}

test.describe("Course Detail Page", () => {
  test("a course that doesn't exist answers 404 with the app's message and a way home", async ({
    page,
  }) => {
    const response = await page.goto(`/b/${AI_ORG_SLUG}/c/nonexistent-course`);

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "We couldn't find this page" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to the home page" })).toBeVisible();
    await expectAccessibleScreen(page, "a missing course");
  });

  test("a language course whose outline isn't written yet leads with its flag and stays on its page", async ({
    page,
  }) => {
    const title = `E2E Language Course ${randomUUID().slice(0, 8)}`;
    const { path } = await publishedCourse({ language: "en", targetLanguage: "pt", title });

    await page.goto(path);

    await expect(page).toHaveURL(path);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole("img", { name: "Brazilian Portuguese" })).toBeVisible();

    await expect(
      page.getByText("The chapters and lessons are written when the first learner starts."),
    ).toBeVisible();

    await expect(page.getByRole("button", { name: "Start this course" }).first()).toBeVisible();
  });

  test("titles a course with a regional language tag in its own language", async ({ page }) => {
    const title = `E2E Regional Course ${randomUUID().slice(0, 8)}`;
    const { path } = await publishedCourse({ language: "pt-BR", title });

    await page.goto(path);

    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page).toHaveTitle(`Aprenda ${title} | Zoonk`);
  });
});
