import { randomUUID } from "node:crypto";
import { type BrowserContext } from "@playwright/test";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { type Page, expect, test } from "./fixtures";
import { type Mode, readDeviceMode, setDeviceMode } from "./learn-personas";
import { createStudyDay, openAs } from "./study-day";

/**
 * Fun is dark only: on a light device a Fun screen renders as it does on a dark one (deep space,
 * `dark:` styles, dark native controls), with light paper for reading. Focus keeps following the
 * device.
 */

/** Deep space, Fun's canvas (`--fun-canvas` in `@zoonk/ui/fun.css`). */
const DEEP_SPACE = "rgb(12, 10, 34)";
const WHITE = "rgb(255, 255, 255)";

/** What a device theme could change on each element: its background, text and color scheme. */
function readColors(page: Page, selectors: string[]) {
  return page.evaluate(
    (list) =>
      list.map((selector) => {
        const element = document.querySelector(selector);

        if (!element) {
          return { missing: selector };
        }

        const style = getComputedStyle(element);

        return {
          background: style.backgroundColor,
          color: style.color,
          scheme: style.colorScheme,
          selector,
        };
      }),
    selectors,
  );
}

/**
 * Opens `path` once the page has taken its mode (so its skeleton is gone) and every element to
 * read is there: a page's own content can stream in after the frame, behind a skeleton of its own.
 */
async function open(page: Page, path: string, selectors: string[]) {
  await page.goto(path);
  await expect(page.locator("html")).toHaveAttribute("data-mode", /^(?:focus|fun)$/u);
  await expect(page.locator(selectors[0] ?? "body")).toBeVisible();

  await Promise.all(
    selectors.map((selector) => expect(page.locator(selector).first()).toBeAttached()),
  );
}

/** Opens `path` on a dark and then on a light device and reads the same elements on both. */
async function readOnBothDevices(page: Page, path: string, selectors: string[]) {
  await page.emulateMedia({ colorScheme: "dark" });
  await open(page, path, selectors);
  const dark = await readColors(page, selectors);

  await page.emulateMedia({ colorScheme: "light" });
  await open(page, path, selectors);
  const light = await readColors(page, selectors);

  return { dark, light };
}

/**
 * The frame the learner's page renders in. The skeleton that holds its place while it loads has
 * one too, but it's gone once `open` returns: only the frame puts the mode on `<html>`.
 */
const SHELL = '[data-slot="mode-root"] [data-slot="learn-shell"]';

/** Where each part of a page that waits for data starts, streamed after the static shell. */
const STREAMED_PART = '<div hidden id="S:';

/** A script that never loads: the page keeps loading, as while the rest of its stream is on its way. */
const HELD_STREAM = "/e2e-held-stream.js";

/**
 * Hard-loads `path` and holds what streams after its static shell, as when the learner's frame is
 * slow to arrive, so the page shows the skeleton it paints first.
 */
async function openBeforeFrame(page: Page, path: string) {
  await page.route(`**${HELD_STREAM}`, () => page.waitForEvent("close"));

  await page.route(
    (url) => url.pathname === path,
    async (route) => {
      if (!route.request().isNavigationRequest()) {
        await route.fallback();
        return;
      }

      const response = await route.fetch();
      const html = await response.text();
      const shellEnd = html.indexOf(STREAMED_PART);

      // A page with nothing streamed after its shell has no skeleton to check.
      if (shellEnd === -1) {
        await route.abort();
        return;
      }

      await route.fulfill({
        body: `${html.slice(0, shellEnd)}<script src="${HELD_STREAM}"></script>`,
        contentType: "text/html",
      });
    },
  );

  await page.goto(path, { waitUntil: "commit" });
}

/**
 * Hard-loads `path` in a new page on a device that keeps `mode`, held before the learner's frame,
 * and checks the skeleton it paints first. Each page closes after, so held routes don't pile up.
 */
async function expectSkeleton(
  context: BrowserContext,
  { background, mode, name, path }: { background: string; mode: Mode; name: string; path: string },
) {
  await setDeviceMode(context, mode);
  const page = await context.newPage();
  await openBeforeFrame(page, path);

  await expect(page.locator('[data-slot="mode-root"]'), name).toHaveAttribute("data-mode", mode);
  await expect(page.locator("body"), name).toHaveCSS("background-color", background);

  if (mode === "fun") {
    await expect(page.locator("html"), name).toHaveCSS("color-scheme", "dark");
  }

  await page.close();
}

test.describe("Fun is dark only", () => {
  test("a Fun learner's Today and lesson look the same on a light device as on a dark one, before any script too", async ({
    browser,
  }) => {
    const [{ user }, { lesson }] = await Promise.all([
      createStudyDay({ mode: "fun" }),
      playableLessonFixture(),
    ]);

    const page = await openAs(browser, user);
    const today = await readOnBothDevices(page, "/today", [SHELL, "html", "body", `${SHELL} h1`]);

    expect(today.light).toEqual(today.dark);

    await expect(page.locator(SHELL)).toHaveCSS("background-color", DEEP_SPACE);
    await expect(page.locator("body")).toHaveCSS("background-color", DEEP_SPACE);
    await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");

    // The learner's page keeps their mode on the device for the next hard load's skeleton.
    await expect.poll(() => readDeviceMode(page.context())).toBe("fun");

    // Reading happens on light paper, whose native controls are light too.
    const paper = page.locator('[data-slot="fun-paper"]');

    const reading = await readOnBothDevices(page, `/learn/${lesson.id}`, [
      '[data-slot="fun-paper"]',
      "html",
      "body",
    ]);

    expect(reading.light).toEqual(reading.dark);
    await expect(paper).toHaveCSS("background-color", WHITE);
    await expect(paper).toHaveCSS("color-scheme", "light");
    await expect(page.locator("body")).toHaveCSS("background-color", DEEP_SPACE);

    // The page behind a Fun screen is deep space before any script runs.
    const withoutScripts = await browser.newContext({
      colorScheme: "light",
      javaScriptEnabled: false,
      storageState: user.storageState,
      timezoneId: "UTC",
    });

    const staticPage = await withoutScripts.newPage();
    await staticPage.goto("/today");

    await expect(staticPage.locator("html")).toHaveCSS("color-scheme", "dark");
    await expect(staticPage.locator("body")).toHaveCSS("background-color", DEEP_SPACE);

    await Promise.all([withoutScripts.close(), page.context().close()]);
  });

  test("onboarding in Fun is deep space on a light device, with its dark styles", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    await setDeviceMode(context, "fun");
    const page = await context.newPage();

    // The goal examples' icons have their own `dark:` colors.
    const start = await readOnBothDevices(page, "/start", [
      '[aria-labelledby="goal-examples-title"] svg.lucide-graduation-cap',
      '[data-slot="onboarding-frame"]',
      "body",
    ]);

    expect(start.light).toEqual(start.dark);

    await expect(page.locator('[data-slot="onboarding-frame"]')).toHaveCSS(
      "background-color",
      DEEP_SPACE,
    );

    await context.close();
  });

  test("a Fun guest's landing page stays light on a light device, around its deep-space Fun preview", async ({
    page,
  }) => {
    const guest = await page.request.post("/api/auth/sign-in/anonymous", {
      data: {},
      headers: { Origin: getBaseURL() },
    });

    expect(guest.ok(), await guest.text()).toBe(true);

    await setDeviceMode(page.context(), "fun");
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");

    await expect(page.locator("body")).toHaveCSS("background-color", WHITE);
    await expect(page.locator("html")).not.toHaveCSS("color-scheme", "dark");

    await page.getByRole("tab", { name: "Fun" }).click();

    await expect(page.getByRole("tabpanel", { name: "Fun" })).toHaveCSS(
      "background-color",
      DEEP_SPACE,
    );

    await expect(page.locator("body")).toHaveCSS("background-color", WHITE);
  });

  test("Focus still follows the device's theme, and takes the device back from Fun", async ({
    browser,
  }) => {
    const { user } = await createStudyDay({ mode: "focus" });
    const page = await openAs(browser, user);

    // A device that kept Fun from before: the Focus learner's page sets it back.
    await setDeviceMode(page.context(), "fun");
    const today = await readOnBothDevices(page, "/today", [SHELL]);

    expect(today.light).toEqual([expect.objectContaining({ background: WHITE })]);
    expect(today.dark).not.toEqual(today.light);
    await expect.poll(() => readDeviceMode(page.context())).toBe("focus");

    await page.context().close();
  });
});

test.describe("A hard load's first paint", () => {
  test.use({ colorScheme: "light" });

  /**
   * Learner pages whose skeleton paints before the learner's frame, which knows the mode, arrives.
   * The shell is the same for everyone, so a visitor's device shows it, light for Focus.
   */
  const SKELETONS = [
    { background: DEEP_SPACE, mode: "fun", name: "Today", path: "/today" },
    { background: DEEP_SPACE, mode: "fun", name: "Settings", path: "/settings/appearance" },
    { background: DEEP_SPACE, mode: "fun", name: "The session", path: "/session" },
    { background: DEEP_SPACE, mode: "fun", name: "A lesson", path: `/learn/${randomUUID()}` },
    { background: DEEP_SPACE, mode: "fun", name: "Onboarding", path: "/start" },
    { background: WHITE, mode: "focus", name: "Today in Focus", path: "/today" },
  ] as const;

  test("a skeleton paints in the mode the device keeps before the learner's frame arrives", async ({
    context,
  }) => {
    for (const skeleton of SKELETONS) {
      // oxlint-disable-next-line no-await-in-loop -- One page at a time, so held streams don't pile up.
      await expectSkeleton(context, skeleton);
    }
  });
});
