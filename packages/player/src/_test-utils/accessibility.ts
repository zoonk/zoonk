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
import axe from "axe-core";
import { expect } from "vitest";
import { onDevice } from "./device-media";

/**
 * Accessibility scans of the player's screens, by the rules the apps' E2E scans use
 * (`@zoonk/e2e/fixtures/accessibility`): axe-core reads the screen showing now, in light and dark
 * (the device's `prefers-color-scheme`, which the player follows), and a serious or critical
 * violation fails it, as does an interactive target under 44 px.
 */

/** How long one check waits for running animations before it looks again. */
const MAX_ANIMATION_WAIT_MS = 3000;

/** Longer than any entrance animation or transition: a screen still moving by then is a finding. */
const ANIMATIONS_TIMEOUT_MS = 15_000;

/**
 * The player renders into a page its host app owns, which gives the document its title and
 * language. The test page has neither, so these rules would read the harness, not the player.
 */
const HOST_DOCUMENT_RULES = {
  "document-title": { enabled: false },
  "html-has-lang": { enabled: false },
};

type AxeColor = { prototype: { parseString: (this: unknown, color: string) => unknown } };

/**
 * Chrome writes a gray's hue as `none` (`oklch(0.145 0 none)`, which is every neutral token), and
 * axe-core 4.13 can't parse it, so it leaves those contrast checks incomplete instead of measuring
 * them. Until it can, a missing hue reads as 0, the same gray.
 */
function readMissingHuesAsZero() {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- axe's color tools aren't typed.
  const { Color } = (axe.commons as unknown as { color: { Color: AxeColor } }).color;
  const parse = Color.prototype.parseString;

  Color.prototype.parseString = function parseString(color) {
    return parse.call(this, color.replaceAll(" none", " 0"));
  };
}

readMissingHuesAsZero();

/**
 * Lets entrance animations and theme transitions end, so contrast is read on the screen people
 * see rather than halfway through a fade.
 */
async function waitForAnimations() {
  await expect
    .poll(() => settleAnimations(MAX_ANIMATION_WAIT_MS), { timeout: ANIMATIONS_TIMEOUT_MS })
    .toBe(0);
}

/** The screen's serious and critical violations and its targets under 44 px, described. */
async function scanScreen(where: string): Promise<string[]> {
  await waitForAnimations();

  const results = await axe.run(document, {
    resultTypes: ["violations"],
    rules: HOST_DOCUMENT_RULES,
  });

  const smallTargets = findSmallTargets(sampleTargets(TARGET_SELECTOR)).map(
    (target) => `${where}: [target-size] ${target} (needs ${MIN_TARGET_PX} px)`,
  );

  return [...describeViolations(results.violations, where).failing, ...smallTargets];
}

/**
 * The screen as every test finds the device, light, then dark. Dark mode is CSS alone, so
 * switching the device's scheme restyles the same screen in place.
 */
async function scanInEachScheme(label: string): Promise<string[]> {
  const light = await scanScreen(`${label} (light)`);
  const dark = await onDevice({ colorScheme: "dark" }, () => scanScreen(`${label} (dark)`));
  return [...light, ...dark];
}

/** The screen showing now, with its animations held at their end (`stillAnimations`). */
async function scanCurrentScreen(label: string): Promise<string[]> {
  stillAnimations();

  try {
    return await scanInEachScheme(label);
  } finally {
    resumeAnimations();
  }
}

/**
 * Fails with every finding when the screen showing now has a serious or critical violation or a
 * target under 44 px, in either scheme.
 */
export async function expectAccessibleScreen(label: string) {
  await expect(scanCurrentScreen(label)).resolves.toStrictEqual([]);
}
