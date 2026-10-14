import { type BrowserContext, type ConsoleMessage, type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { expect, test } from "./fixtures";

/** Main's session hint (`SESSION_HINT_COOKIE` in `apps/main/src/lib/learner/session-hint.ts`). */
const SESSION_HINT_COOKIE = "zoonk-signed-in";

/** What React says when the page it hydrates doesn't match the server's (minified in builds). */
const HYDRATION_ERROR = /hydrat|Minified React error #(?:418|423|425)/iu;

async function getSessionHint(context: BrowserContext): Promise<string | null> {
  const cookies = await context.cookies();
  return cookies.find((cookie) => cookie.name === SESSION_HINT_COOKIE)?.value ?? null;
}

/** Whether the hint script marked the page as one a learner is reading. */
function isMarkedSignedIn(page: Page): Promise<boolean> {
  return page.locator("html").evaluate((html) => Object.hasOwn(html.dataset, "signedIn"));
}

/** The console's errors and warnings, for checking hydration went through. */
function watchConsole(page: Page): ConsoleMessage[] {
  const messages: ConsoleMessage[] = [];

  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      messages.push(message);
    }
  });

  return messages;
}

test.describe("Signed-in hint", () => {
  test("marks a page as signed in before it paints only when the hint says so, without writing it", async ({
    browser,
  }) => {
    for (const [hint, marked] of [
      [null, false],
      ["0", false],
      ["yes", false],
      ["1", true],
    ] as const) {
      // oxlint-disable-next-line no-await-in-loop -- One browser at a time keeps failures readable.
      const context = await browser.newContext();

      if (hint) {
        // oxlint-disable-next-line no-await-in-loop -- Each browser starts with its own hint.
        await context.addCookies([{ name: SESSION_HINT_COOKIE, url: getBaseURL(), value: hint }]);
      }

      // oxlint-disable-next-line no-await-in-loop -- Each browser opens its own page.
      const page = await context.newPage();

      // Without the learner summary, nothing but the page itself runs on the hint.
      // oxlint-disable-next-line no-await-in-loop -- The route is set before the page opens.
      await page.route("**/api/learner/summary", (route) => route.abort());

      // oxlint-disable-next-line no-await-in-loop -- One page at a time keeps failures readable.
      const response = await page.goto("/pricing", { waitUntil: "domcontentloaded" });

      expect(response?.headers()["set-cookie"], String(hint)).toBeUndefined();
      // oxlint-disable-next-line no-await-in-loop -- One page at a time keeps failures readable.
      expect(await isMarkedSignedIn(page), String(hint)).toBe(marked);

      // The page only reads the hint: it's still what the browser had.
      // oxlint-disable-next-line no-await-in-loop -- One page at a time keeps failures readable.
      await page.waitForLoadState("load");
      // oxlint-disable-next-line no-await-in-loop -- One page at a time keeps failures readable.
      expect(await getSessionHint(context), String(hint)).toBe(hint);

      // oxlint-disable-next-line no-await-in-loop -- One browser at a time keeps failures readable.
      await context.close();
    }
  });

  test("hydrates the marked page without a mismatch, for a learner and a visitor", async ({
    browser,
    page: visitor,
  }) => {
    const user = await createE2EUser(getBaseURL());
    const context = await browser.newContext({ storageState: user.storageState });
    const learner = await context.newPage();
    const messages = [watchConsole(learner), watchConsole(visitor)];

    // Hydrated: the learner's account menu comes from the learner summary the page reads after it.
    await learner.goto("/pricing");
    expect(await isMarkedSignedIn(learner)).toBe(true);

    await expect(
      learner.getByRole("banner").getByRole("button", { name: /User menu$/u }),
    ).toBeVisible();

    // Hydrated: the visitor's page asked who's reading, and the answer left the hint at "none".
    await visitor.goto("/pricing");
    expect(await isMarkedSignedIn(visitor)).toBe(false);
    await expect.poll(() => getSessionHint(visitor.context())).toBe("0");

    const errors = messages.flat().map((message) => message.text());
    expect(errors.filter((text) => HYDRATION_ERROR.test(text))).toStrictEqual([]);

    await context.close();
  });

  test("no static page's response sets a cookie, for a visitor or a learner with the hint", async ({
    page: visitor,
    userWithoutProgress: learner,
  }) => {
    const paths = [
      "/",
      "/pricing",
      "/pt/pricing",
      "/privacy",
      "/terms",
      "/courses",
      "/courses/science",
    ];

    for (const page of [visitor, learner]) {
      for (const path of paths) {
        // oxlint-disable-next-line no-await-in-loop -- One page at a time keeps failures readable.
        const response = await page.request.get(path, { maxRedirects: 0 });
        expect(response.headers()["set-cookie"], path).toBeUndefined();
      }
    }
  });

  test("a hint left by a session that ended is dropped, and the next page isn't marked", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());
    const context = await browser.newContext({ storageState: user.storageState });
    const page = await context.newPage();

    await page.goto("/pricing");
    expect(await isMarkedSignedIn(page)).toBe(true);

    // The session ends on the server while the browser still has the hint (and no cached copy).
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await context.clearCookies({ name: /session_data/u });

    await page.reload();
    await expect.poll(() => getSessionHint(context)).toBe("0");

    await page.reload();
    expect(await isMarkedSignedIn(page)).toBe(false);
    await expect(page.getByRole("banner").getByRole("link", { name: "Log in" })).toBeVisible();

    await context.close();
  });

  test("signing out drops the hint, and the next page isn't marked", async ({ logoutPage }) => {
    await logoutPage.setViewportSize({ height: 900, width: 1440 });
    await logoutPage.goto("/settings");
    expect(await isMarkedSignedIn(logoutPage)).toBe(true);

    await logoutPage
      .getByRole("complementary", { name: "Sidebar" })
      .getByRole("button", { name: /User menu$/u })
      .click();

    await Promise.all([
      logoutPage.waitForEvent("framenavigated", {
        predicate: (frame) => frame === logoutPage.mainFrame(),
      }),
      logoutPage.getByRole("menuitem", { name: "Log out" }).click(),
    ]);

    expect(await getSessionHint(logoutPage.context())).toBe("0");

    await logoutPage.goto("/pricing");
    expect(await isMarkedSignedIn(logoutPage)).toBe(false);
  });
});
