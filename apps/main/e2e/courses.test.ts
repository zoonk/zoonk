import { randomUUID } from "node:crypto";
import { setLocale } from "@zoonk/e2e/fixtures/locale";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { normalizeString } from "@zoonk/utils/string";
import { type Page, expect, test } from "./fixtures";

const UUID_SHORT_LENGTH = 8;

async function createPublishedCourse(language: string) {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, UUID_SHORT_LENGTH);
  const title = `E2E Course ${uniqueId}`;

  const course = await courseFixture({
    isPublished: true,
    language,
    normalizedTitle: normalizeString(title),
    organizationId: org.id,
    slug: `e2e-courses-${uniqueId}`,
    title,
    userCount: 50,
  });

  // Course needs a chapter so the detail page renders instead of redirecting
  await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    position: 0,
  });

  return course;
}

/**
 * Sentry reports this regression through the browser's unhandled rejection
 * handler, so the e2e test records that same signal while the UI keeps running.
 */
async function recordUnhandledRejections(page: Page) {
  await page.addInitScript(() => {
    const unhandledRejections: string[] = [];

    Object.defineProperty(globalThis, "zoonkE2EUnhandledRejections", {
      value: unhandledRejections,
    });

    globalThis.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason;
      unhandledRejections.push(reason instanceof Error ? reason.message : String(reason));
    });
  });
}

/**
 * Browser-side rejection events are stored in the page context because
 * Playwright does not expose all `unhandledrejection` events as test failures.
 */
async function getUnhandledRejections(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const target = globalThis as unknown as { zoonkE2EUnhandledRejections?: string[] };
    return target.zoonkE2EUnhandledRejections ?? [];
  });
}

test.describe("Courses Page - Basic", () => {
  test("clicking course card navigates to course detail", async ({ page }) => {
    const course = await createPublishedCourse("en");

    const courseLink = page.getByRole("link", { name: new RegExp(course.title, "iu") });

    await expect(async () => {
      await page.goto("/courses");
      await expect(courseLink).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 15_000 });

    await courseLink.click();

    await expect(page).toHaveURL(new RegExp(`/b/${AI_ORG_SLUG}/c/${course.slug}$`, "u"));
    await expect(page.getByRole("heading", { level: 1, name: course.title })).toBeVisible();
  });
});

test.describe("Courses Page - Infinite Loading", () => {
  test("loads more courses when scrolling to the bottom", async ({ page }) => {
    const org = await getAiOrganization();

    // Create 25 courses to exceed the page limit (20)
    await Promise.all(
      Array.from({ length: 25 }, () =>
        courseFixture({ isPublished: true, language: "en", organizationId: org.id }),
      ),
    );

    const courseList = page.getByRole("main").getByRole("list");
    const courseLinks = courseList.getByRole("link");

    // Wait for the courses page to load with the initial 20 items
    await expect(async () => {
      await page.goto("/courses");
      await expect(courseLinks).toHaveCount(20, { timeout: 5000 });
    }).toPass({ timeout: 15_000 });

    // Scroll to the bottom to trigger infinite loading
    await page.evaluate(() => globalThis.scrollTo(0, document.body.scrollHeight));

    // Verify more courses loaded after scrolling
    await expect(async () => {
      const count = await courseLinks.count();
      expect(count).toBeGreaterThan(20);
    }).toPass({ timeout: 10_000 });
  });

  test("lets users retry failed load-more requests without unhandled rejections", async ({
    page,
  }) => {
    const org = await getAiOrganization();
    const failedLoadMoreRequests: string[] = [];
    const loadMoreRequests: string[] = [];

    await recordUnhandledRejections(page);

    await Promise.all(
      Array.from({ length: 25 }, () =>
        courseFixture({ isPublished: true, language: "en", organizationId: org.id }),
      ),
    );

    await page.route("**/courses", async (route) => {
      const request = route.request();
      const isLoadMoreAction = request.method() === "POST";

      if (isLoadMoreAction) {
        loadMoreRequests.push(request.url());

        if (loadMoreRequests.length === 1) {
          failedLoadMoreRequests.push(request.url());
          await route.abort("failed");
          return;
        }
      }

      await route.continue();
    });

    const courseList = page.getByRole("main").getByRole("list");
    const courseLinks = courseList.getByRole("link");

    await expect(async () => {
      await page.goto("/courses");
      await expect(courseLinks).toHaveCount(20, { timeout: 5000 });
    }).toPass({ timeout: 15_000 });

    await page.evaluate(() => globalThis.scrollTo(0, document.body.scrollHeight));

    await expect(async () => {
      expect(failedLoadMoreRequests.length).toBeGreaterThan(0);
    }).toPass({ timeout: 10_000 });

    await expect(page.getByLabel(/loading more courses/iu)).not.toBeVisible();
    await expect(page.getByRole("button", { name: /try again/iu })).toBeVisible();
    expect(failedLoadMoreRequests).toHaveLength(1);
    expect(await getUnhandledRejections(page)).toEqual([]);

    await page.getByRole("button", { name: /try again/iu }).click();

    await expect(async () => {
      const count = await courseLinks.count();
      expect(count).toBeGreaterThan(20);
    }).toPass({ timeout: 10_000 });

    expect(loadMoreRequests).toHaveLength(2);
    expect(await getUnhandledRejections(page)).toEqual([]);
  });
});

test.describe("Courses Page - Locale", () => {
  test("Portuguese locale shows translated content", async ({ page }) => {
    await setLocale(page, "pt");
    await page.goto("/courses");

    await expect(page.getByRole("heading", { name: /explorar cursos/iu })).toBeVisible();
  });

  test("unpublished courses are hidden", async ({ page }) => {
    const org = await getAiOrganization();
    const uniqueId = randomUUID().slice(0, UUID_SHORT_LENGTH);
    const title = `E2E Curso Não Publicado ${uniqueId}`;

    const unpublishedCourse = await courseFixture({
      isPublished: false,
      language: "pt",
      normalizedTitle: normalizeString(title),
      organizationId: org.id,
      slug: `e2e-unpublished-${uniqueId}`,
      title,
    });

    await setLocale(page, "pt");
    await page.goto("/courses");

    await expect(page.getByText(unpublishedCourse.title)).not.toBeVisible();
  });
});
