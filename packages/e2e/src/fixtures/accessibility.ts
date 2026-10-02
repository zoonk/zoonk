import { AxeBuilder } from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";
import { listMovingAnimations } from "@zoonk/testing/accessibility/motion";
import {
  describeViolations,
  resumeAnimations,
  settleAnimations,
  stillAnimations,
} from "@zoonk/testing/accessibility/scan";
import {
  MIN_TARGET_PX,
  TARGET_SELECTOR,
  findSmallTargets,
  sampleTargets,
} from "@zoonk/testing/accessibility/target-size";

/**
 * Accessibility scans for browser tests: axe-core reads a screen where a flow already shows it, at
 * the flow's width, in light and dark (the device's `prefers-color-scheme`, which Focus follows),
 * and a test fails on any serious or critical violation. Lesser findings are listed in the report
 * without failing it. Fun is dark only, so a Fun screen is scanned once, on a light device, where it
 * must stay dark. Every scan also checks that each interactive target is at least 44 px by 44 px.
 */

/** Dark first, so a scan leaves the device light, as the browser starts. */
const COLOR_SCHEMES = ["dark", "light"] as const;

/** How long one check waits for running animations before it looks again. */
const MAX_ANIMATION_WAIT_MS = 3000;

/** Longer than any entrance animation or transition: a screen still moving by then is a finding. */
const ANIMATIONS_TIMEOUT_MS = 15_000;

export type AccessibilityRoute = {
  /** Named in failures next to the path, e.g. "the Fun buddy page". */
  label?: string;
  path: string;
  /** Waits until the screen shows what the scan should read; the page's h1 by default. */
  ready?: (page: Page) => Promise<void>;
};

async function waitForFirstHeading(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

/**
 * Lets entrance animations and theme transitions end (`settleAnimations`), until a frame passes
 * with none running.
 */
async function waitForAnimations(page: Page) {
  await expect
    .poll(() => page.evaluate(settleAnimations, MAX_ANIMATION_WAIT_MS), {
      timeout: ANIMATIONS_TIMEOUT_MS,
    })
    .toBe(0);
}

/**
 * Scans the current screen and returns its serious and critical violations and its targets under
 * 44 px, described.
 */
async function scanScreen(page: Page, where: string): Promise<string[]> {
  await waitForAnimations(page);

  const [results, targets] = await Promise.all([
    // Screens have no iframes, so axe runs in the page (legacy mode) instead of merging frame
    // results in a new blank page each scan, and it gathers only violations, all a scan reads.
    new AxeBuilder({ page })
      .setLegacyMode()
      .options({ resultTypes: ["violations"] })
      .disableRules(["document-title"])
      .analyze(),
    page.evaluate(sampleTargets, TARGET_SELECTOR),
  ]);

  const { failing, minor } = describeViolations(results.violations, where);

  if (minor.length > 0) {
    test
      .info()
      .annotations.push(...minor.map((description) => ({ description, type: "a11y-minor" })));
  }

  return [
    ...failing,
    ...findSmallTargets(targets).map(
      (target) => `${where}: [target-size] ${target} (needs ${MIN_TARGET_PX} px)`,
    ),
  ];
}

/** A screen inside the learner's Fun mode (not a Fun preview on a Focus page). */
async function isFunScreen(page: Page): Promise<boolean> {
  return (await page.locator('[data-slot="mode-root"][data-mode="fun"]').count()) > 0;
}

/**
 * Fun is dark only: on a light device the page still gets deep space and dark native controls.
 * Returns a finding when it doesn't.
 */
async function findLightFun(page: Page, where: string): Promise<string[]> {
  const scheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
  return scheme === "dark" ? [] : [`${where}: Fun renders with a "${scheme}" color scheme`];
}

/**
 * Scans the screen in dark and light (Fun: light only, checked to stay dark). Dark mode is CSS
 * alone (`prefers-color-scheme`), so switching the device's scheme restyles the same screen
 * without reloading it.
 */
async function scanInEachScheme(page: Page, label: string): Promise<string[]> {
  if (await isFunScreen(page)) {
    await page.emulateMedia({ colorScheme: "light" });
    const where = `${label} (light)`;
    return [...(await findLightFun(page, where)), ...(await scanScreen(page, where))];
  }

  const found: string[] = [];

  for (const colorScheme of COLOR_SCHEMES) {
    // oxlint-disable-next-line no-await-in-loop -- The same screen is scanned in each scheme.
    await page.emulateMedia({ colorScheme });
    // oxlint-disable-next-line no-await-in-loop -- The same screen is scanned in each scheme.
    found.push(...(await scanScreen(page, `${label} (${colorScheme})`)));
  }

  return found;
}

/**
 * Scans the screen showing now at its current width, with its animations held at their end
 * (`stillAnimations`), and returns what it found.
 */
async function scanCurrentScreen(page: Page, label: string): Promise<string[]> {
  // axe's `document-title` rule, checked the web-first way: when a refresh renders the page's
  // metadata again, Next.js swaps the <title> element (seen up to 8 ms apart after a session's
  // answer), and a scan landing in that gap would fail a page that has a title.
  await expect(page, `${label}: the page has a title`).toHaveTitle(/\S/u);
  await page.evaluate(stillAnimations);

  try {
    return await scanInEachScheme(page, label);
  } finally {
    await page.evaluate(resumeAnimations);
  }
}

function expectNoViolations(violations: string[]) {
  expect(violations, violations.join("\n")).toEqual([]);
}

/**
 * Fails on the screen showing now if it has a serious or critical violation or a target under
 * 44 px, for flows that reach a screen by playing it (answers, feedback, completion). The device
 * ends light, as it starts.
 */
export async function expectAccessibleScreen(page: Page, label: string) {
  expectNoViolations(await scanCurrentScreen(page, label));
}

/**
 * Opens each route at the page's width and scans it (`expectAccessibleScreen`), for screens no
 * flow shows on the way. Fails with every violation the routes have, so one failure names all of
 * them instead of the first.
 */
export async function expectAccessibleRoutes(page: Page, routes: AccessibilityRoute[]) {
  const found: string[] = [];

  for (const route of routes) {
    const label = route.label ?? route.path;

    // oxlint-disable-next-line no-await-in-loop -- One page visits each route in turn.
    await page.goto(route.path);

    // A screen that never shows what it should is a finding too; the scan still reads it.
    // oxlint-disable-next-line no-await-in-loop -- One page visits each route in turn.
    const unready = await (route.ready ?? waitForFirstHeading)(page).then(
      () => [],
      (error: unknown) => [`${label}: not ready: ${String(error).split("\n")[0]}`],
    );

    // oxlint-disable-next-line no-await-in-loop -- One page visits each route in turn.
    found.push(...unready, ...(await scanCurrentScreen(page, label)));
  }

  expectNoViolations(found);
}

/** The animations on the page that move something (`listMovingAnimations`). */
export async function findMovingAnimations(page: Page): Promise<string[]> {
  return page.evaluate(listMovingAnimations);
}
