import { randomUUID } from "node:crypto";
import { setLocale } from "@zoonk/e2e/fixtures/locale";
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
  test("non-existent course invites the learner to create it", async ({ page }) => {
    await page.goto(`/b/${AI_ORG_SLUG}/c/nonexistent-course`);

    await expect(
      page.getByRole("heading", { name: "You found a course that hasn't been written yet" }),
    ).toBeVisible();

    await expect(
      page.getByRole("img", { name: "An open book becoming a learning path" }),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "Create this course" })).toHaveAttribute(
      "href",
      "/start",
    );
  });

  test("a language course leads with the flag of the variety it teaches", async ({ page }) => {
    const title = `E2E Language Course ${randomUUID().slice(0, 8)}`;
    const { path } = await publishedCourse({ language: "en", targetLanguage: "pt", title });

    await page.goto(path);

    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole("img", { name: "Brazilian Portuguese" })).toBeVisible();
  });

  test("a course whose outline isn't written yet stays on its page", async ({ page }) => {
    const title = `E2E Unwritten Course ${randomUUID().slice(0, 8)}`;
    const { path } = await publishedCourse({ language: "en", title });

    await page.goto(path);

    await expect(page).toHaveURL(path);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

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

  test("renders the page in the Portuguese locale", async ({ page }) => {
    const title = `E2E Curso PT ${randomUUID().slice(0, 8)}`;
    const { path } = await publishedCourse({ language: "pt", title });

    await setLocale(page, "pt");
    await page.goto(`/pt${path}`);

    await expect(page).toHaveURL(`/pt${path}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "pt");
    await expect(page.getByRole("button", { name: "Começar este curso" }).first()).toBeVisible();
  });
});
