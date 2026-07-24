import { prisma } from "@zoonk/db";
import { setLocale } from "@zoonk/e2e/fixtures/locale";
import { type Page, expect, test } from "./fixtures";

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

/**
 * Reads the destinations that are actually visible so infinite loading can
 * prove it appended a new course without depending on names or database order.
 */
async function getRenderedCourseHrefs(page: Page): Promise<string[]> {
  const courseLinks = page.getByRole("main").getByRole("list").getByRole("link");

  return courseLinks.evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
}

/**
 * Distinguishes an appended page from a rerender of the original courses by
 * checking whether the catalog gained at least one new destination.
 */
async function hasNewCourseHref({
  initialHrefs,
  page,
}: {
  initialHrefs: string[];
  page: Page;
}): Promise<boolean> {
  const renderedHrefs = await getRenderedCourseHrefs(page);
  const initialHrefSet = new Set(initialHrefs);

  return renderedHrefs.some((href) => !initialHrefSet.has(href));
}

test.describe("Courses Page - Basic", () => {
  test("clicking course card navigates to course detail", async ({ page }) => {
    await page.goto("/courses");

    const courseLink = page.getByRole("main").getByRole("list").getByRole("link").first();

    await expect(courseLink).toBeVisible();

    const courseHref = await courseLink.getAttribute("href");

    if (!courseHref) {
      throw new Error("Missing rendered course href");
    }

    const coursePathSegments = new URL(courseHref, page.url()).pathname.split("/");
    const brandSlug = coursePathSegments.at(-3);
    const courseSlug = coursePathSegments.at(-1);

    if (!brandSlug || !courseSlug) {
      throw new Error(`Invalid rendered course href: ${courseHref}`);
    }

    const course = await prisma.course.findFirstOrThrow({
      where: { organization: { slug: brandSlug }, slug: courseSlug },
    });

    await courseLink.click();

    await expect(page.getByRole("heading", { level: 1, name: course.title })).toBeVisible();
  });

  test("empty category lets users create a course about that category", async ({ page }) => {
    await page.goto("/courses/law");

    const createCourseLink = page.getByRole("link", { name: "Create a course about Law" });

    await expect(createCourseLink).toBeVisible();
    await createCourseLink.click();

    await expect(page).toHaveURL(/\/start\/learn$/u);
  });
});

test.describe("Courses Page - Infinite Loading", () => {
  test("loads more courses when scrolling to the bottom", async ({ page }) => {
    await page.goto("/courses");

    await expect.poll(() => getRenderedCourseHrefs(page), { timeout: 10_000 }).not.toHaveLength(0);

    const initialCourseHrefs = await getRenderedCourseHrefs(page);

    await page.evaluate(() => globalThis.scrollTo(0, document.body.scrollHeight));

    await expect
      .poll(() => hasNewCourseHref({ initialHrefs: initialCourseHrefs, page }), { timeout: 10_000 })
      .toBe(true);
  });

  test("lets users retry failed load-more requests without unhandled rejections", async ({
    page,
  }) => {
    const failedLoadMoreRequests: string[] = [];
    const loadMoreRequests: string[] = [];

    await recordUnhandledRejections(page);

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

    await page.goto("/courses");

    await expect.poll(() => getRenderedCourseHrefs(page), { timeout: 10_000 }).not.toHaveLength(0);

    const initialCourseHrefs = await getRenderedCourseHrefs(page);

    await page.evaluate(() => globalThis.scrollTo(0, document.body.scrollHeight));

    await expect(async () => {
      expect(failedLoadMoreRequests.length).toBeGreaterThan(0);
    }).toPass({ timeout: 10_000 });

    await expect(page.getByLabel(/loading more courses/iu)).not.toBeVisible();
    await expect(page.getByRole("button", { name: /try again/iu })).toBeVisible();
    expect(failedLoadMoreRequests).toHaveLength(1);
    expect(await getUnhandledRejections(page)).toEqual([]);

    await page.getByRole("button", { name: /try again/iu }).click();

    await expect
      .poll(() => hasNewCourseHref({ initialHrefs: initialCourseHrefs, page }), { timeout: 10_000 })
      .toBe(true);

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
});
