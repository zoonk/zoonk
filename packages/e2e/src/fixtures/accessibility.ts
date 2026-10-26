import { AxeBuilder } from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";
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
 * the flow's width, in light and dark (the device's `prefers-color-scheme`, which the app follows),
 * and a test fails on any serious or critical violation. Lesser findings are listed in the report
 * without failing it. Every scan also checks that each interactive target is at least 44 px by
 * 44 px.
 */

/** Dark first, so a scan leaves the device light, as the browser starts. */
const COLOR_SCHEMES = ["dark", "light"] as const;

/** How long one check waits for running animations before it looks again. */
const MAX_ANIMATION_WAIT_MS = 3000;

/** Longer than any entrance animation or transition: a screen still moving by then is a finding. */
const ANIMATIONS_TIMEOUT_MS = 15_000;

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

/**
 * Scans the screen in dark and light, on a device asking for more contrast, so the strict-contrast
 * values are checked too (the regular look also keeps WCAG AA, faint labels included).
 * Dark mode and contrast are CSS alone (`prefers-color-scheme`, `prefers-contrast`), so switching
 * them restyles the same screen without reloading it. The device ends with no contrast preference.
 */
async function scanInEachScheme(page: Page, label: string): Promise<string[]> {
  const found: string[] = [];

  try {
    for (const colorScheme of COLOR_SCHEMES) {
      // oxlint-disable-next-line no-await-in-loop -- The same screen is scanned in each scheme.
      await page.emulateMedia({ colorScheme, contrast: "more" });
      // oxlint-disable-next-line no-await-in-loop -- The same screen is scanned in each scheme.
      found.push(...(await scanScreen(page, `${label} (${colorScheme})`)));
    }
  } finally {
    await page.emulateMedia({ contrast: null });
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
