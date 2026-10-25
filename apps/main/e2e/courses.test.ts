import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
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

/** The catalog's courses, apart from its categories' list beside them on wide screens. */
function getCourseList(page: Page) {
  return page.getByRole("main").getByRole("list", { name: "Courses" });
}

/**
 * Reads the destinations that are actually visible so infinite loading can
 * prove it appended a new course without depending on names or database order.
 */
async function getRenderedCourseHrefs(page: Page): Promise<string[]> {
  const courseLinks = getCourseList(page).getByRole("link");

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

    const courseLink = getCourseList(page).getByRole("link").first();

    await expect(courseLink).toBeVisible();
    await expectAccessibleScreen(page, "the catalog");

    const courseHref = await courseLink.getAttribute("href");

    if (!courseHref) {
      throw new Error("Missing rendered course href");
    }

    const courseUrl = new URL(courseHref, page.url()).toString();
    const courseCardText = await courseLink.innerText();

    await courseLink.click();

    await expect(page).toHaveURL(courseUrl);

    const courseHeading = page.getByRole("heading", { level: 1 });

    await expect(courseHeading).toBeVisible();
    expect(courseCardText).toContain(await courseHeading.innerText());
  });

  test("wide screens show the categories beside the courses as cards, three up, and phones list one course per row", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 1000, width: 1600 });
    await page.goto("/courses");

    const courses = getCourseList(page);
    const categories = page.getByRole("navigation", { name: "Course categories" });

    await expect(courses.getByRole("listitem").first()).toBeVisible();

    await expect(categories.getByRole("link", { name: "All" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    // The categories are a column on the left; the courses fill the page's width beside them, three
    // cards to a row, each wide enough to read.
    const [categoriesBox, first, second, third] = await Promise.all([
      categories.boundingBox(),
      courses.getByRole("listitem").nth(0).boundingBox(),
      courses.getByRole("listitem").nth(1).boundingBox(),
      courses.getByRole("listitem").nth(2).boundingBox(),
    ]);

    expect(first!.x).toBeGreaterThan(categoriesBox!.x + categoriesBox!.width);
    expect(second!.y).toBe(first!.y);
    expect(third!.y).toBe(first!.y);
    expect(first!.width).toBeGreaterThan(220);
    expect(first!.width).toBeLessThan(320);

    // On a phone a long catalog reads as a list: each course a row as wide as the column, its
    // picture (when it has one) beside its title, so a screen shows several courses with their
    // descriptions.
    await page.setViewportSize({ height: 844, width: 390 });

    const [firstRow, secondRow] = await Promise.all([
      courses.getByRole("listitem").nth(0).boundingBox(),
      courses.getByRole("listitem").nth(1).boundingBox(),
    ]);

    expect(firstRow!.width).toBeGreaterThan(340);
    // A row stays compact even when its title takes two lines beside its chevron.
    expect(firstRow!.height).toBeLessThan(130);
    expect(secondRow!.y).toBeGreaterThan(firstRow!.y + firstRow!.height - 1);
  });

  test("on a phone, a category opened from a link shows its chip in the row, past the screen's edge", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/courses/tech");

    const chip = page
      .getByRole("navigation", { name: "Course categories" })
      .getByRole("link", { name: "Technology" });

    await expect(chip).toHaveAttribute("aria-current", "page");
    await expect(chip).toBeInViewport({ ratio: 1 });
  });

  test("each category says how many courses it has, and each course its lessons and time as its page does", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 1000, width: 1600 });
    await page.goto("/courses/science");

    const categories = page.getByRole("navigation", { name: "Course categories" });
    const science = categories.getByRole("link", { name: /^Science \d+$/u });

    await expect(science).toHaveAttribute("aria-current", "page");
    await expect(categories.getByRole("link", { name: /^All \d+$/u })).toBeVisible();

    const scienceCount = Number(/\d+/u.exec(await science.innerText())?.[0]);

    await expect(getCourseList(page).getByRole("listitem")).toHaveCount(scienceCount);

    const course = getCourseList(page).getByRole("link", { name: /Quantum physics from scratch/u });
    await expect(course).toBeVisible();
    await expect(course).toContainText("one short lesson at a time");
    await expect(course).toHaveAttribute("href", /\/c\/quantum-physics-from-scratch$/u);
    await expectAccessibleScreen(page, "a catalog category");
    const meta = /^(?<lessons>\d+) lessons · (?<duration>.+)$/mu.exec(await course.innerText());

    expect(meta?.groups).toBeDefined();

    await course.click();

    // The outline states the same lesson count and duration after its chapter count.
    await expect(
      page
        .getByRole("region", { name: "Course outline" })
        .getByText(
          new RegExp(
            `^\\d+ chapters · ${meta?.groups?.lessons} short lessons · ${meta?.groups?.duration}$`,
            "u",
          ),
        ),
    ).toBeVisible();
  });

  test("an empty category offers to start a goal instead", async ({ page }) => {
    await page.goto("/courses/law");

    const startGoalLink = page.getByRole("main").getByRole("link", { name: "Start a goal" });

    await expect(startGoalLink).toBeVisible();
    await startGoalLink.click();

    await expect(page).toHaveURL(/\/start$/u);
    await expect(page.getByRole("heading", { name: "What do you want to achieve?" })).toBeVisible();
  });

  test("a category that doesn't exist, or a path under one, answers 404 inside the catalog", async ({
    page,
  }) => {
    const main = page.getByRole("main");
    const unknownCategory = await page.goto("/courses/not-a-category");

    expect(unknownCategory?.status()).toBe(404);
    await expect(main.getByRole("heading", { name: "We couldn't find this page" })).toBeVisible();
    await expect(main.getByRole("link", { exact: true, name: "Explore courses" })).toBeVisible();

    const oldCourseLink = await page.goto("/pt/courses/science/um-curso-antigo");

    expect(oldCourseLink?.status()).toBe(404);
    await expect(main.getByRole("heading", { name: "Não encontramos esta página" })).toBeVisible();
    await expect(main.getByRole("link", { exact: true, name: "Explorar cursos" })).toBeVisible();
  });
});

test.describe("Courses Page - Infinite Loading", () => {
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
  test("sorts categories using the active app locale", async ({ browser }) => {
    // A phone, where the categories are a row of chips that scrolls sideways, in a browser whose
    // own language isn't the page's. Only categories with courses are listed, so the page is one
    // whose catalog has several.
    const browserContext = await browser.newContext({
      locale: "cs-CZ",
      viewport: { height: 844, width: 390 },
    });

    const page = await browserContext.newPage();
    const hydrationErrors: Error[] = [];

    page.on("pageerror", (error) => hydrationErrors.push(error));

    try {
      await page.goto("/pt/courses");
      await expect(page.getByRole("button", { name: "Rolar para a direita" })).toBeVisible();
      expect(hydrationErrors).toEqual([]);

      const labels = await page
        .getByRole("navigation", { name: "Categorias de cursos" })
        .getByRole("link")
        .allTextContents();

      const categoryLabels = labels.slice(1);
      const portugueseCollator = new Intl.Collator("pt");

      const expectedLabels = categoryLabels.toSorted((first, second) =>
        portugueseCollator.compare(first, second),
      );

      expect(categoryLabels.length).toBeGreaterThan(1);
      expect(categoryLabels).toStrictEqual(expectedLabels);
    } finally {
      await browserContext.close();
    }
  });
});
