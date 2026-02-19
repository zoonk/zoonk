import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { expect, test } from "./fixtures";

test.describe("Org Home - Permissions", () => {
  test("returns not found for non-existent org", async ({ ownerPage }) => {
    await ownerPage.goto("/non-existent-org");

    await expect(ownerPage.getByRole("heading", { name: /404/i })).toBeVisible();
  });

  test("allows owner to view page", async ({ ownerPage }) => {
    await ownerPage.goto(`/${AI_ORG_SLUG}`);

    await expect(ownerPage.getByRole("heading", { name: /draft courses/i })).toBeVisible();
  });

  test("allows admin to view page", async ({ authenticatedPage }) => {
    await authenticatedPage.goto(`/${AI_ORG_SLUG}`);

    await expect(authenticatedPage.getByRole("heading", { name: /draft courses/i })).toBeVisible();
  });

  test("denies member access", async ({ memberPage }) => {
    await memberPage.goto(`/${AI_ORG_SLUG}`);

    await expect(memberPage.getByRole("heading", { name: /401.*unauthorized/i })).toBeVisible();
  });

  test("denies non-org member access", async ({ userWithoutOrg }) => {
    await userWithoutOrg.goto(`/${AI_ORG_SLUG}`);

    await expect(userWithoutOrg.getByRole("heading", { name: /401.*unauthorized/i })).toBeVisible();
  });

  test("denies unauthenticated access", async ({ page }) => {
    await page.goto(`/${AI_ORG_SLUG}`);

    await expect(page.getByRole("heading", { name: /401.*unauthorized/i })).toBeVisible();
  });
});

test.describe("Org Home - Course Filtering", () => {
  let draftCourseTitle: string;
  let publishedCourseTitle: string;

  test.beforeAll(async () => {
    const org = await getAiOrganization();

    const uniqueId = randomUUID().slice(0, 8);

    const [draftCourse, publishedCourse] = await Promise.all([
      courseFixture({
        isPublished: false,
        organizationId: org.id,
        slug: `e2e-draft-${uniqueId}`,
        title: `E2E Draft ${uniqueId}`,
      }),
      courseFixture({
        isPublished: true,
        organizationId: org.id,
        slug: `e2e-published-${uniqueId}`,
        title: `E2E Published ${uniqueId}`,
      }),
    ]);

    draftCourseTitle = draftCourse.title;
    publishedCourseTitle = publishedCourse.title;
  });

  test("shows only courses from this org", async ({ ownerPage }) => {
    await ownerPage.goto(`/${AI_ORG_SLUG}`);

    await expect(ownerPage.getByText(draftCourseTitle)).toBeVisible();
  });

  test("shows only draft courses, not published", async ({ ownerPage }) => {
    await ownerPage.goto(`/${AI_ORG_SLUG}`);

    await expect(ownerPage.getByText(draftCourseTitle)).toBeVisible();
    await expect(ownerPage.getByText(publishedCourseTitle)).not.toBeVisible();
  });
});

test.describe("Org Home - Navigation", () => {
  test("clicking create course navigates to creation page", async ({ ownerPage }) => {
    await ownerPage.goto(`/${AI_ORG_SLUG}`);
    await ownerPage.getByRole("link", { name: /create course/i }).click();

    await expect(ownerPage).toHaveURL(/\/ai\/new-course/);
    await expect(ownerPage.getByText(/course title/i)).toBeVisible();
  });
});
