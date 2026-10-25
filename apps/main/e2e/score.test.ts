import { instant } from "@next/playwright";
import { expect, test } from "./fixtures";
import {
  AT_ONCE_MS,
  codeArrivedBy,
  followCodeWith,
  followRequests,
  markPaintedFrames,
  paintedFramesSince,
  settleIdleWork,
  slowCodeFromNow,
  watchPaintedFrames,
} from "./on-demand-code";

const CHART_SIZE_WARNING = "The width(-1) and height(-1) of chart should be greater than 0";

const TREND = 'figure[aria-label="Weekly score trend"]';

/** The trend's box, and the trend drawn in it. */
const TREND_FRAMES = { drawn: `${TREND}:has(svg)`, empty: `${TREND}:not(:has(svg))` };

/** What the trend's code has in it: the class of the svg it draws. */
const TREND_CODE = "recharts-surface";

/**
 * How many frames a page may paint without its trend once its box has hydrated and its code is in.
 * The trend renders, takes its box's size and draws: a frame or two, three on a device eight times
 * slower. A Suspense fallback React holds for 300 ms paints more while it waits: 9 to 18 frames,
 * still 5 on a device four times slower. Milliseconds can't tell them apart on a busy machine.
 */
const DRAWN_WITHIN_FRAMES = 4;

test.describe("Score", () => {
  test("shows one weighted 90-day score with its answers on tiles, the weekly trend and one line", async ({
    browser,
    withProgressUser,
  }) => {
    const context = await browser.newContext({ storageState: withProgressUser.storageState });
    const page = await context.newPage();
    const chartWarnings: string[] = [];

    page.on("console", (message) => {
      if (message.text().includes(CHART_SIZE_WARNING)) {
        chartWarnings.push(message.text());
      }
    });

    try {
      await page.goto("/score");

      await expect(
        page.getByRole("heading", { exact: true, level: 1, name: "Score" }),
      ).toBeAttached();

      const tiles = page.locator('[data-slot="stat-tile"]');
      const scoreChart = page.getByRole("figure", { name: /weekly score trend/iu });

      await expect(tiles.filter({ hasText: /^Score/u })).toContainText(/\d+(?:\.\d+)?%/u);
      await expect(tiles.filter({ hasText: /^Right/u })).toContainText(/\d+ of \d+/u);
      await expect(scoreChart).toBeVisible();

      // The 90-day window is said once, on its tile.
      await expect(page.getByText(/90 days/iu)).toHaveCount(1);

      // The trend renders at its size, without the chart library's invalid size warnings.
      expect(chartWarnings).toEqual([]);

      await expect(
        page.getByText(
          "Every answer counts the same, so harder lessons can lower your score for a while.",
        ),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("draws the trend as its page hydrates, wherever the page shows it", async ({
    browser,
    withProgressUser,
  }) => {
    // The overview shows it from a tablet up; Score at every width.
    const opened = [
      { path: "/stats", width: 1280 },
      { path: "/score", width: 1280 },
      { path: "/score", width: 390 },
    ];

    for (const { path, width } of opened) {
      // oxlint-disable-next-line no-await-in-loop -- Each page opens in a new tab, one after another.
      const context = await browser.newContext({
        storageState: withProgressUser.storageState,
        viewport: { height: 900, width },
      });

      // oxlint-disable-next-line no-await-in-loop
      await watchPaintedFrames(context, TREND_FRAMES);
      // oxlint-disable-next-line no-await-in-loop
      const page = await context.newPage();
      const trendCode = followCodeWith({ marker: TREND_CODE, page });

      try {
        // oxlint-disable-next-line no-await-in-loop
        await page.goto(path);
        // oxlint-disable-next-line no-await-in-loop
        await expect(page.locator(TREND_FRAMES.drawn)).toBeVisible();

        // oxlint-disable-next-line no-await-in-loop
        const frames = await paintedFramesSince(page);
        const drawn = frames.find((frame) => frame.seen.drawn !== "none");
        // Drawn as it hydrated, its box never shows hydrated and empty.
        const hydrated = frames.find((frame) => frame.seen.empty === "hydrated") ?? drawn;
        expect(drawn, `${path} at ${width}px`).toBeDefined();

        // Its code was on the way while the page loaded, before its box hydrated...
        // oxlint-disable-next-line no-await-in-loop
        const requestedAt = await trendCode.requestedAt();
        expect(requestedAt, `${path} at ${width}px`).toBeLessThan(hydrated?.at ?? 0);

        // ...and once the box has hydrated with the page's code in, the trend is drawn.
        // oxlint-disable-next-line no-await-in-loop
        const codeIn = await codeArrivedBy({ at: hydrated?.at ?? 0, page });
        const since = Math.max(hydrated?.at ?? 0, codeIn);

        const withoutTrend = frames.filter(
          (frame) => frame.at > since && frame.seen.drawn === "none",
        );

        expect(withoutTrend.length, `${path} at ${width}px`).toBeLessThanOrEqual(
          DRAWN_WITHIN_FRAMES,
        );
      } finally {
        // oxlint-disable-next-line no-await-in-loop
        await context.close();
      }
    }
  });

  test("a phone opens Score from its tile with the trend drawn, even when code arrives slowly", async ({
    browser,
    withProgressUser,
  }) => {
    const context = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      storageState: withProgressUser.storageState,
      viewport: { height: 844, width: 390 },
    });

    await watchPaintedFrames(context, TREND_FRAMES);
    const page = await context.newPage();
    const requests = followRequests(page);

    try {
      await page.goto("/stats");
      await expect(page.getByRole("heading", { level: 1, name: "Statistics" })).toBeVisible();

      // From here on code arrives as over a phone's network. The overview, which doesn't show the
      // trend on a phone, loads its code once it's idle, for its Score tile.
      await slowCodeFromNow(page);
      await settleIdleWork(page, requests);
      await markPaintedFrames(page);

      await page.getByRole("link", { name: /^Score /u }).tap();

      // Score opens at once with its trend drawn: never an empty box, never a tap that waits.
      await expect(page.locator(TREND_FRAMES.drawn)).toBeVisible({ timeout: AT_ONCE_MS });
      await expect(page).toHaveURL(/\/score$/u);

      const frames = await paintedFramesSince(page);
      expect(frames.filter((frame) => frame.seen.empty !== "none")).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test("the sidebar's Statistics opens the overview with its trend drawn once reached for, even when code arrives slowly", async ({
    browser,
    withProgressUser,
  }) => {
    // A pointer resting on the link, or the keyboard's focus on it.
    for (const reach of ["hover", "focus"] as const) {
      // oxlint-disable-next-line no-await-in-loop -- Each way in opens in a new tab, one after another.
      const context = await browser.newContext({
        storageState: withProgressUser.storageState,
        viewport: { height: 900, width: 1280 },
      });

      // oxlint-disable-next-line no-await-in-loop
      await watchPaintedFrames(context, TREND_FRAMES);
      // oxlint-disable-next-line no-await-in-loop
      const page = await context.newPage();
      const requests = followRequests(page);

      try {
        // oxlint-disable-next-line no-await-in-loop
        await page.goto("/level");

        const statistics = page
          .getByRole("complementary", { name: "Sidebar" })
          .getByRole("link", { name: "Statistics" });

        // oxlint-disable-next-line no-await-in-loop
        await expect(statistics).toBeVisible();

        // From here on code arrives as over a slow network. Reaching for the link starts loading
        // the trend's code along with the page.
        // oxlint-disable-next-line no-await-in-loop
        await slowCodeFromNow(page);
        // oxlint-disable-next-line no-await-in-loop
        await (reach === "hover" ? statistics.hover() : statistics.focus());
        // oxlint-disable-next-line no-await-in-loop
        await requests.settled();
        // oxlint-disable-next-line no-await-in-loop
        await markPaintedFrames(page);

        // oxlint-disable-next-line no-await-in-loop
        await instant(page, async () => {
          await (reach === "hover" ? statistics.click() : page.keyboard.press("Enter"));
          await expect(page).toHaveURL(/\/stats$/u);

          await expect(page.locator(TREND_FRAMES.drawn), reach).toBeVisible({
            timeout: AT_ONCE_MS,
          });
        });

        // oxlint-disable-next-line no-await-in-loop
        const frames = await paintedFramesSince(page);
        const empty = frames.filter((frame) => frame.seen.empty !== "none");
        expect(empty, reach).toEqual([]);
      } finally {
        // oxlint-disable-next-line no-await-in-loop
        await context.close();
      }
    }
  });
});
