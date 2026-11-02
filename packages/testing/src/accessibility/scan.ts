import { type NodeResult, type Result } from "axe-core";

const FAILING_IMPACTS = new Set(["critical", "serious"]);

const LISTED_TARGETS = 5;

const HTML_LENGTH = 120;

function describeNode(node: NodeResult) {
  const target = `${node.target.join(" ")} \`${node.html.slice(0, HTML_LENGTH)}\``;
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

  return `${where}: [${violation.impact}] ${violation.id}: ${violation.help} (${violation.helpUrl}) → ${listed}${more}`;
}

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
 * Lets a scan read an element that fades in again every few seconds as people see it, not mid-fade.
 * It and `resumeAnimations` read nothing outside themselves, so Playwright can send them with
 * `page.evaluate`.
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
 * Returns how many animations were running. A transition can start a frame after another ends, so
 * callers repeat it until it returns 0. It reads nothing outside itself, so Playwright can send it
 * with `page.evaluate`.
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
