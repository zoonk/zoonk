import { type Page } from "@playwright/test";
import { getFreePlanLimits } from "@zoonk/core/entitlements/plan-limits";
import { expect, test } from "./fixtures";
import { openAsGuest } from "./guest-session";

/** Every public page, prerendered whole, with its title. */
const PUBLIC_PAGES = [
  { path: "/", title: "Know what to study every day until the big day." },
  { path: "/pricing", title: "Start free. Plus when you want everything." },
  { path: "/pt/pricing", title: "Comece grátis." },
  { path: "/privacy", title: "Privacy Policy" },
  { path: "/terms", title: "Terms of Service" },
  { path: "/courses", title: "Explore courses" },
  { path: "/courses/science", title: "Courses in Science" },
] as const;

/** The page as the server sent it, before any script ran, with its tags dropped. */
async function getServedPage(page: Page, path: string) {
  const response = await page.request.get(path, { maxRedirects: 0 });
  expect(response.status(), path).toBe(200);

  const html = await response.text();
  const main = html.slice(html.indexOf("<main"), html.lastIndexOf("</main>"));
  const title = /<h1[^>]*>(?<text>.*?)<\/h1>/su.exec(html)?.groups?.text ?? "";

  return { html, main, title: title.replaceAll(/<[^>]+>/gu, "") };
}

/**
 * Where each plan's card starts saying what it includes, under its action: these rows, and the page
 * under them, move if an action changes size.
 */
async function getPricingRows(page: Page) {
  const limits = getFreePlanLimits();

  const rows = [
    page
      .getByRole("region", { exact: true, name: "Free" })
      .getByText(`${limits.activeGoals} goal · ${limits.lessonsPerMonth} lessons a month`),
    page.getByRole("region", { exact: true, name: "Plus" }).getByText("Every goal · every lesson"),
  ];

  return Promise.all(rows.map((row) => row.boundingBox()));
}

test.describe("Static public pages", () => {
  test("serve the whole page in the HTML, with its title and no loading placeholder", async ({
    page,
  }) => {
    for (const { path, title } of PUBLIC_PAGES) {
      // oxlint-disable-next-line no-await-in-loop -- One page at a time keeps failures readable.
      const served = await getServedPage(page, path);

      expect(served.title, path).toContain(title);
      expect(served.main, path).not.toContain('data-slot="skeleton"');
    }

    // Pricing's questions and its closing call are in the HTML too.
    const pricing = await getServedPage(page, "/pricing");
    expect(pricing.main).toContain("Common questions");
    expect(pricing.main).toContain("Start free, no account needed.");

    // The footer's languages open the same page from the HTML, before any script runs, so a tap
    // right after the page shows never lands on another language's home page.
    for (const path of ["/pricing", "/privacy", "/terms"]) {
      // oxlint-disable-next-line no-await-in-loop -- One page at a time keeps failures readable.
      const { html } = await getServedPage(page, path);

      expect(html, path).toContain(`href="/de${path}"`);
      expect(html, path).not.toContain('href="/de"');
    }
  });

  test("serve a learner the very page a visitor gets", async ({
    noProgressUser,
    page: visitor,
    userWithoutProgress: learner,
  }) => {
    // The home page sends anyone with a session to Today instead.
    for (const { path } of PUBLIC_PAGES.filter((item) => item.path !== "/")) {
      // oxlint-disable-next-line no-await-in-loop -- One page at a time keeps failures readable.
      const { html } = await getServedPage(learner, path);

      expect(html, path).not.toContain(noProgressUser.email);
      expect(html, path).not.toContain(noProgressUser.id);

      // A page regenerated between the two reads (another test changed the courses) reads again.
      // oxlint-disable-next-line no-await-in-loop -- One page at a time keeps failures readable.
      await expect
        .poll(
          async () => {
            const [theirs, mine] = await Promise.all([
              getServedPage(visitor, path),
              getServedPage(learner, path),
            ]);

            return mine.html === theirs.html;
          },
          { message: path },
        )
        .toBe(true);
    }
  });

  test("show a learner their bar and their next steps once the page opens, without moving the page", async ({
    userWithoutProgress: learner,
  }) => {
    await learner.setViewportSize({ height: 900, width: 1440 });

    // The learner summary is held back, so the page first shows what its HTML has.
    const summary = Promise.withResolvers<null>();

    await learner.route("**/api/learner/summary", async (route) => {
      await summary.promise;
      await route.continue();
    });

    await learner.goto("/pricing");

    const banner = learner.getByRole("banner");
    const freePlan = learner.getByRole("region", { exact: true, name: "Free" });

    await expect(freePlan.getByRole("link", { name: "Start free" })).toBeVisible();
    const before = await getPricingRows(learner);
    expect(before.every(Boolean)).toBe(true);

    summary.resolve(null);

    await expect(banner.getByRole("button", { name: /User menu$/u })).toBeVisible();
    await expect(banner.getByRole("link", { name: "Log in" })).toHaveCount(0);
    await expect(freePlan.getByText("Your current plan")).toBeVisible();
    await expect(freePlan.getByRole("link", { name: "Start free" })).toHaveCount(0);

    // The plans keep their rows where they were, so nothing under them moves either.
    expect(await getPricingRows(learner)).toStrictEqual(before);

    // Further down, the free plan's answer is for someone with an account, and the closing call to
    // start free, a visitor's, is gone: a learner has already started.
    await expect(
      learner
        .getByRole("region", { name: "Common questions" })
        .getByText("With the free plan, you get:"),
    ).toBeVisible();

    await expect(
      learner.getByRole("region", { name: "Start free, no account needed." }),
    ).toHaveCount(0);
  });

  test("show a guest the account the free plan comes with", async ({ browser }) => {
    const { context, page } = await openAsGuest(browser);

    await page.goto("/pricing");

    await expect(
      page
        .getByRole("region", { exact: true, name: "Free" })
        .getByRole("link", { name: "Create a free account" }),
    ).toHaveAttribute("href", "/login?next=%2Fpricing");

    await context.close();
  });
});
