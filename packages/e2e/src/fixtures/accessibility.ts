import { AxeBuilder } from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";
import { MIN_TARGET_PX, findSmallTargets } from "./target-size";

/**
 * Accessibility scans for browser tests: axe-core runs on a screen at phone and desktop widths, in
 * light and dark (the device's `prefers-color-scheme`, which Focus follows), and a test fails on
 * any serious or critical violation. Lesser findings are listed in the report without failing it.
 * Fun is dark only, so a Fun screen is scanned once, on a light device, where it must stay dark.
 * Every scan also checks that each interactive target is at least 44 px by 44 px (`findSmallTargets`).
 */

const PHONE = { height: 812, width: 375 };
const DESKTOP = { height: 900, width: 1280 };

/** The widths every screen is scanned at; flows that play a screen loop over them too. */
export const ACCESSIBILITY_VIEWPORTS = [
  { name: "phone", size: PHONE },
  { name: "desktop", size: DESKTOP },
] as const;

const COLOR_SCHEMES = ["light", "dark"] as const;

const FAILING_IMPACTS = new Set(["critical", "serious"]);

/** How long one check waits for running animations before it looks again. */
const MAX_ANIMATION_WAIT_MS = 3000;

/** Longer than any entrance animation or transition: a screen still moving by then is a finding. */
const ANIMATIONS_TIMEOUT_MS = 15_000;

/** How many offending elements a violation lists before it only counts the rest. */
const LISTED_TARGETS = 5;

type AxeResults = Awaited<ReturnType<AxeBuilder["analyze"]>>;
type AxeViolation = AxeResults["violations"][number];

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
 * Lets entrance animations and theme transitions end, so contrast is measured on the screen people
 * read rather than halfway through a fade. Endless animations (pulses, spinners) and scroll-driven
 * ones (they end with the scroll) keep running. A transition can start a frame after another ends,
 * so it waits until a frame passes with none.
 */
async function waitForAnimations(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(async (maxWaitMs) => {
          const running = document
            .getAnimations()
            .filter(
              (animation) =>
                animation.playState === "running" &&
                animation.timeline === document.timeline &&
                animation.effect?.getComputedTiming().iterations !== Infinity,
            );

          const finished = Promise.all(
            running.map((animation) => animation.finished.catch(() => null)),
          );

          const timeout = new Promise((resolve) => {
            setTimeout(resolve, maxWaitMs);
          });

          await Promise.race([finished, timeout]);

          await new Promise((resolve) => {
            requestAnimationFrame(() => {
              requestAnimationFrame(resolve);
            });
          });

          return running.length;
        }, MAX_ANIMATION_WAIT_MS),
      { timeout: ANIMATIONS_TIMEOUT_MS },
    )
    .toBe(0);
}

type AxeNode = AxeViolation["nodes"][number];

/** Contrast findings name their colors, so a failure says which token to fix. */
function describeNode(node: AxeNode) {
  const target = node.target.join(" ");
  const data: unknown = node.any[0]?.data;

  if (data && typeof data === "object" && "contrastRatio" in data) {
    const { bgColor, contrastRatio, fgColor } = data as Record<string, unknown>;
    return `${target} (${String(fgColor)} on ${String(bgColor)}, ${String(contrastRatio)}:1)`;
  }

  return target;
}

function describeViolation(violation: AxeViolation, where: string) {
  const targets = violation.nodes.map((node) => describeNode(node));
  const listed = targets.slice(0, LISTED_TARGETS).join(" | ");
  const more = targets.length > LISTED_TARGETS ? ` (+${targets.length - LISTED_TARGETS} more)` : "";

  return `${where}: [${violation.impact}] ${violation.id}: ${violation.help} → ${listed}${more}`;
}

/**
 * Scans the current screen and returns its serious and critical violations and its targets under
 * 44 px, described.
 */
async function scanScreen(page: Page, where: string): Promise<string[]> {
  await waitForAnimations(page);

  const [results, smallTargets] = await Promise.all([
    new AxeBuilder({ page }).analyze(),
    findSmallTargets(page),
  ]);

  const failing = results.violations.filter((violation) =>
    FAILING_IMPACTS.has(violation.impact ?? ""),
  );

  const minor = results.violations.filter((violation) => !failing.includes(violation));

  if (minor.length > 0) {
    test
      .info()
      .annotations.push(
        ...minor.map((violation) => ({
          description: describeViolation(violation, where),
          type: "a11y-minor",
        })),
      );
  }

  return [
    ...failing.map((violation) => describeViolation(violation, where)),
    ...smallTargets.map(
      (target) => `${where}: [target-size] ${target} (needs ${MIN_TARGET_PX} px)`,
    ),
  ];
}

type ColorScheme = (typeof COLOR_SCHEMES)[number];
type Viewport = (typeof ACCESSIBILITY_VIEWPORTS)[number];

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

async function scanVariant(
  page: Page,
  {
    colorScheme,
    route,
    viewport,
  }: { colorScheme: ColorScheme; route: AccessibilityRoute; viewport: Viewport },
) {
  const where = `${route.label ?? route.path} (${viewport.name}, ${colorScheme})`;

  await page.setViewportSize(viewport.size);
  await page.emulateMedia({ colorScheme });
  await page.goto(route.path);

  // A screen that never shows what it should is a finding too; the scan still reads it.
  const unready = await (route.ready ?? waitForFirstHeading)(page).then(
    () => [],
    (error: unknown) => [`${where}: not ready: ${String(error).split("\n")[0]}`],
  );

  return [...unready, ...(await scanScreen(page, where))];
}

/**
 * Opens a route on a light device and scans it, then on a dark one unless it's a Fun screen, which
 * looks the same on both and is checked to stay dark instead.
 */
async function scanRoute(page: Page, route: AccessibilityRoute, viewport: Viewport) {
  const light = await scanVariant(page, { colorScheme: "light", route, viewport });

  if (await isFunScreen(page)) {
    const where = `${route.label ?? route.path} (${viewport.name}, light)`;
    return [...light, ...(await findLightFun(page, where))];
  }

  return [...light, ...(await scanVariant(page, { colorScheme: "dark", route, viewport }))];
}

/**
 * Opens each route at phone and desktop widths in light and dark (Fun: light only) and scans it.
 * Returns every serious or critical violation, so one failure names all of them instead of the
 * first.
 */
async function scanRoutes(page: Page, routes: AccessibilityRoute[]): Promise<string[]> {
  const variants = routes.flatMap((route) =>
    ACCESSIBILITY_VIEWPORTS.map((viewport) => ({ route, viewport })),
  );

  const found: string[] = [];

  for (const { route, viewport } of variants) {
    // oxlint-disable-next-line no-await-in-loop -- One page visits each variant in turn.
    found.push(...(await scanRoute(page, route, viewport)));
  }

  return found;
}

/** Fails with every serious or critical violation the routes have, in every variant. */
export async function expectAccessibleRoutes(page: Page, routes: AccessibilityRoute[]) {
  const violations = await scanRoutes(page, routes);
  expect(violations, violations.join("\n")).toEqual([]);
}

/**
 * Scans the screen showing now in light and dark at its current width (Fun: light only, checked to
 * stay dark), for flows that reach a screen by playing it (answers, feedback, completion) instead
 * of opening a URL.
 */
export async function scanCurrentScreen(page: Page, label: string): Promise<string[]> {
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
 * The animations on screen that move something (a transform that changes between their first and
 * a later frame), named by animation and element. With reduced motion there should be none: calm
 * versions fade or stay still. Spinners, which show work in progress, don't count.
 */
export async function findMovingAnimations(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    document.getAnimations().flatMap((animation) => {
      const element = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
      const name = "animationName" in animation ? String(animation.animationName) : "script";
      const duration = Number(animation.effect?.getComputedTiming().duration ?? 0);

      if (
        !element ||
        name === "spin" ||
        duration === 0 ||
        animation.timeline !== document.timeline
      ) {
        return [];
      }

      const resume = animation.currentTime;
      animation.currentTime = 0;
      const start = getComputedStyle(element).transform;
      animation.currentTime = duration / 2;
      const middle = getComputedStyle(element).transform;
      animation.currentTime = resume;

      const tag = element.tagName.toLowerCase();
      const classes = element.getAttribute("class") ?? "";

      return start === middle ? [] : [`${name} on <${tag} class="${classes}">`];
    }),
  );
}
