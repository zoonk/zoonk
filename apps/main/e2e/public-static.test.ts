import { type Page } from "@playwright/test";
import { getFreePlanLimits } from "@zoonk/core/entitlements/plan-limits";
import { expect, test } from "./fixtures";
import { openAsGuest } from "./guest-session";
import { getServedPage } from "./served-page";

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

const PHONE = { height: 844, width: 390 };
const DESKTOP = { height: 900, width: 1440 };

/** Holds back the page's read of the learner summary until `release`, so it first shows its HTML. */
async function holdLearnerSummary(page: Page): Promise<() => void> {
  const summary = Promise.withResolvers<null>();

  await page.route("**/api/learner/summary", async (route) => {
    await summary.promise;
    await route.continue();
  });

  return () => summary.resolve(null);
}

/**
 * Checks every frame the page can paint, from its first, for a displayed "Log in" in its bar, so a
 * flash that's gone before the page settles still counts (`wasLogInShown`).
 */
async function watchLogInShown(page: Page) {
  await page.addInitScript(() => {
    const state = globalThis as typeof globalThis & { logInShown?: boolean };
    state.logInShown = false;

    const checkFrame = () => {
      for (const link of document.querySelectorAll("header a")) {
        if (link.textContent.trim() === "Log in" && link.getClientRects().length > 0) {
          state.logInShown = true;
        }
      }

      requestAnimationFrame(checkFrame);
    };

    requestAnimationFrame(checkFrame);
  });
}

function wasLogInShown(page: Page): Promise<boolean | undefined> {
  return page.evaluate(
    () => (globalThis as typeof globalThis & { logInShown?: boolean }).logInShown,
  );
}

test.describe("Static public pages", () => {
  test("serve the whole page in the HTML, with its title and no loading placeholder", async ({
    page,
  }) => {
    for (const { path, title } of PUBLIC_PAGES) {
      // oxlint-disable-next-line no-await-in-loop -- One page at a time keeps failures readable.
      const served = await getServedPage(page, path);

      expect(served.heading, path).toContain(title);
      expect(served.skeletons, path).toBe(0);
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

  for (const viewport of [PHONE, DESKTOP]) {
    test(`a learner sees no visitor's way in while the page waits for who they are, and nothing moves when it knows (${viewport.width} px)`, async ({
      userWithoutProgress: learner,
    }) => {
      await learner.setViewportSize(viewport);
      await watchLogInShown(learner);
      const release = await holdLearnerSummary(learner);

      await learner.goto("/pricing");

      // Their browser's session hint says a session is there: a quiet place for their account
      // instead of "Log in", and no visitor's step on the plans or at the end of the page.
      const banner = learner.getByRole("banner");
      const slot = banner.locator('[data-slot="public-account-slot"]');
      const freePlan = learner.getByRole("region", { exact: true, name: "Free" });

      await expect(slot).toBeVisible();
      await expect(banner.getByRole("link", { name: "Log in" })).toHaveCount(0);
      await expect(banner.getByRole("link", { name: "Start free" })).toHaveCount(0);
      await expect(freePlan.getByRole("link", { name: "Start free" })).toBeHidden();

      await expect(
        learner
          .getByRole("region", { exact: true, name: "Plus" })
          .getByRole("link", { name: "Get Plus" }),
      ).toBeHidden();

      await expect(
        learner.getByRole("region", { name: "Start free, no account needed." }),
      ).toHaveCount(0);

      const [bannerBefore, slotBox, rowsBefore] = await Promise.all([
        banner.boundingBox(),
        slot.boundingBox(),
        getPricingRows(learner),
      ]);

      expect(rowsBefore.every(Boolean)).toBe(true);

      release();

      // Their avatar takes the circle's place, and their own steps the visitor's room.
      const account = banner.getByRole("button", { name: /User menu$/u });
      await expect(account).toBeVisible();
      await expect(slot).toHaveCount(0);
      await expect(freePlan.getByText("Your current plan")).toBeVisible();

      expect(await banner.boundingBox()).toStrictEqual(bannerBefore);
      expect(await account.boundingBox()).toStrictEqual(slotBox);
      expect(await wasLogInShown(learner)).toBe(false);
      expect(await getPricingRows(learner)).toStrictEqual(rowsBefore);

      // Further down, the free plan's answer is for someone with an account; the closing call stays
      // a visitor's.
      await expect(
        learner
          .getByRole("region", { name: "Common questions" })
          .getByText("With the free plan, you get:"),
      ).toBeVisible();

      await expect(
        learner.getByRole("region", { name: "Start free, no account needed." }),
      ).toHaveCount(0);
    });

    test(`a visitor sees the way in from the first paint, and nothing moves once the page knows (${viewport.width} px)`, async ({
      page: visitor,
    }) => {
      await visitor.setViewportSize(viewport);
      const release = await holdLearnerSummary(visitor);

      await visitor.goto("/pricing");

      const banner = visitor.getByRole("banner");
      const logIn = banner.getByRole("link", { name: "Log in" });
      const freePlan = visitor.getByRole("region", { exact: true, name: "Free" });

      await expect(logIn).toBeVisible();
      await expect(banner.locator('[data-slot="public-account-slot"]')).toBeHidden();
      await expect(freePlan.getByRole("link", { name: "Start free" })).toBeVisible();

      const [bannerBefore, logInBefore] = await Promise.all([
        banner.boundingBox(),
        logIn.boundingBox(),
      ]);

      release();

      // The summary says nobody is signed in: the hint becomes "none", and the bar stays as it was.
      await expect
        .poll(async () => {
          const cookies = await visitor.context().cookies();
          return cookies.find((cookie) => cookie.name === "zoonk-signed-in")?.value;
        })
        .toBe("0");

      await expect(banner.locator('[data-slot="public-account-slot"]')).toHaveCount(0);
      expect(await banner.boundingBox()).toStrictEqual(bannerBefore);
      expect(await logIn.boundingBox()).toStrictEqual(logInBefore);
    });
  }

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
