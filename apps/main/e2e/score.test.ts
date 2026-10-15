import { expect, test } from "./fixtures";
import {
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

/**
 * How long a hydrated page may take to draw its trend: a frame or two, far under the 300 ms React
 * holds a Suspense fallback once it's shown.
 */
const DRAWN_WITH_PAGE_MS = 200;

/** "At once" for a page opened from a link, well under how late slowed code arrives. */
const AT_ONCE_MS = 1000;

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

      try {
        // oxlint-disable-next-line no-await-in-loop
        await page.goto(path);
        // oxlint-disable-next-line no-await-in-loop
        await expect(page.locator(TREND_FRAMES.drawn)).toBeVisible();

        // oxlint-disable-next-line no-await-in-loop
        const frames = await paintedFramesSince(page);
        const hydrated = frames.find((frame) => frame.seen.empty === "hydrated");
        const drawn = frames.find((frame) => frame.seen.drawn !== "none");

        // Its code was on the way while the page loaded: once the page hydrates, the trend is drawn.
        expect(drawn, `${path} at ${width}px`).toBeDefined();

        expect(
          (drawn?.at ?? 0) - (hydrated?.at ?? drawn?.at ?? 0),
          `${path} at ${width}px`,
        ).toBeLessThanOrEqual(DRAWN_WITH_PAGE_MS);
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
});
