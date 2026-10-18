/**
 * The animations on screen that move something (a transform that changes between their first and
 * a later frame), named by animation and element. With reduced motion there should be none: calm
 * versions fade or stay still. Spinners, which show work in progress, don't count. It runs in the
 * browser and reads nothing outside itself, so Playwright can send it with `page.evaluate` and
 * browser tests can call it directly.
 */
export function listMovingAnimations(): string[] {
  return document.getAnimations().flatMap((animation) => {
    const element = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
    const name = "animationName" in animation ? String(animation.animationName) : "script";
    const duration = Number(animation.effect?.getComputedTiming().duration ?? 0);

    if (!element || name === "spin" || duration === 0 || animation.timeline !== document.timeline) {
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
  });
}
