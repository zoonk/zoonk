import { type NodeResult, type Result } from "axe-core";

/**
 * The rules an accessibility scan applies, wherever axe runs (Playwright in an app's E2E, or a
 * package's browser tests): a serious or critical violation fails the scan, and lesser ones are
 * only listed.
 */

const FAILING_IMPACTS = new Set(["critical", "serious"]);

/** How many offending elements a violation lists before it only counts the rest. */
const LISTED_TARGETS = 5;

/** Contrast findings name their colors, so a failure says which token to fix. */
function describeNode(node: NodeResult) {
  const target = node.target.join(" ");
  const data: unknown = node.any[0]?.data;

  if (data && typeof data === "object" && "contrastRatio" in data) {
    const { bgColor, contrastRatio, fgColor } = data as Record<string, unknown>;
    return `${target} (${String(fgColor)} on ${String(bgColor)}, ${String(contrastRatio)}:1)`;
  }

  return target;
}

function describeViolation(violation: Result, where: string) {
  const targets = violation.nodes.map((node) => describeNode(node));
  const listed = targets.slice(0, LISTED_TARGETS).join(" | ");
  const more = targets.length > LISTED_TARGETS ? ` (+${targets.length - LISTED_TARGETS} more)` : "";

  return `${where}: [${violation.impact}] ${violation.id}: ${violation.help} → ${listed}${more}`;
}

/** A scan's violations, described: the ones that fail it, and the lesser ones it only lists. */
export function describeViolations(violations: Result[], where: string) {
  const failing = violations.filter((violation) => FAILING_IMPACTS.has(violation.impact ?? ""));

  return {
    failing: failing.map((violation) => describeViolation(violation, where)),
    minor: violations
      .filter((violation) => !failing.includes(violation))
      .map((violation) => describeViolation(violation, where)),
  };
}

/**
 * Ends every CSS animation and transition the moment it starts while a scan reads the screen, as
 * Playwright's screenshots do, so an element that fades in again every few seconds (a waiting
 * screen's changing detail line) is read as people see it, not halfway through its fade.
 * `resumeAnimations` takes it away. Both run in the browser and read nothing outside themselves,
 * so Playwright can send them with `page.evaluate` and browser tests can call them directly.
 */
export function stillAnimations() {
  const style = document.createElement("style");
  style.dataset.accessibilityScan = "still";

  style.textContent = [
    "*, ::before, ::after {",
    "animation-delay: 0s !important; animation-duration: 0s !important;",
    "transition-delay: 0s !important; transition-duration: 0s !important; }",
  ].join(" ");

  document.head.append(style);
}

export function resumeAnimations() {
  document.querySelector('style[data-accessibility-scan="still"]')?.remove();
}

/**
 * Waits up to `maxWaitMs` for the screen's entrance animations and theme transitions to end, so
 * contrast is measured on the screen people read rather than halfway through a fade, and returns
 * how many were running. Endless animations (pulses, spinners) and scroll-driven ones (they end with
 * the scroll) don't count. A transition can start a frame after another ends, so callers repeat it
 * until it returns 0. It runs in the browser and reads nothing outside itself, so Playwright can
 * send it with `page.evaluate` and browser tests can call it directly.
 */
export async function settleAnimations(maxWaitMs: number): Promise<number> {
  const running = document
    .getAnimations()
    .filter(
      (animation) =>
        animation.playState === "running" &&
        animation.timeline === document.timeline &&
        animation.effect?.getComputedTiming().iterations !== Infinity,
    );

  const finished = Promise.all(running.map((animation) => animation.finished.catch(() => null)));

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
}
