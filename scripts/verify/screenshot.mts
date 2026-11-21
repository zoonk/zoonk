import { type Page, type PageScreenshotOptions } from "@playwright/test";

/**
 * Playwright 1.65's `animations: "disabled"` also cancels scroll-driven animations, so pictures lose
 * the kit's scroll fades and hairlines. Use it again once a release has
 * https://github.com/microsoft/playwright/pull/44061.
 */
export async function screenshot(
  page: Page,
  options: Omit<PageScreenshotOptions, "animations"> = {},
) {
  const releases = await Promise.all(
    page.frames().map((frame) => frame.evaluateHandle(holdClockAnimations).catch(() => null)),
  );

  try {
    return await page.screenshot({ ...options, animations: "allow" });
  } finally {
    await Promise.all(
      releases
        .filter((release) => release !== null)
        .map((release) => release.evaluate((resume) => resume()).catch(() => null)),
    );
  }
}

function holdClockAnimations() {
  const cancelled = new Set<Animation>();

  function runsOnClock(animation: Animation) {
    return (
      animation.effect !== null &&
      animation.timeline instanceof DocumentTimeline &&
      animation.playbackRate !== 0 &&
      !cancelled.has(animation)
    );
  }

  function hold() {
    const held = document.getAnimations().filter((animation) => runsOnClock(animation));

    for (const animation of held) {
      if (Number.isFinite(animation.effect?.getComputedTiming().endTime)) {
        animation.finish();
      } else {
        animation.cancel();
        cancelled.add(animation);
      }
    }
  }

  hold();
  document.addEventListener("animationstart", hold);
  document.addEventListener("transitionrun", hold);

  return () => {
    document.removeEventListener("animationstart", hold);
    document.removeEventListener("transitionrun", hold);

    for (const animation of cancelled) {
      animation.play();
    }
  };
}
