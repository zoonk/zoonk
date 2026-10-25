import { type Locator } from "@playwright/test";
import { type Page, expect } from "./fixtures";

/** More stops than any screen has before its main action; a longer walk means focus is lost. */
const MAX_TABS = 40;

async function isFocused(target: Locator) {
  return target.evaluate((element) => element === document.activeElement).catch(() => false);
}

/**
 * Keyboard focus can draw its outline or ring on the control or its highlight pseudo-element. Read
 * until it settles, since a ring can grow in with a short transition.
 */
export async function expectVisibleFocus(target: Locator) {
  await expect
    .poll(
      () =>
        target.evaluate((element) => {
          if (element !== document.activeElement) {
            return false;
          }

          /**
           * The shared goal textarea draws its ring on its GoalField form, whose line is a 1px
           * shadow it always has: only a wider ring around it shows focus.
           */
          const goalField =
            element instanceof HTMLTextAreaElement
              ? element.closest('[data-slot="goal-field"]')
              : null;

          if (goalField) {
            const { boxShadow } = getComputedStyle(goalField);
            const spreads = [...boxShadow.matchAll(/(?<spread>\d+(?:\.\d+)?)px(?=,|$)/gu)];
            return spreads.some((match) => Number(match.groups?.spread) >= 2);
          }

          return [null, "::before", "::after"].some((pseudo) => {
            const style = getComputedStyle(element, pseudo);

            if (
              style.display === "none" ||
              style.visibility === "hidden" ||
              style.opacity === "0"
            ) {
              return false;
            }

            const outline = style.outlineStyle !== "none" && style.outlineWidth !== "0px";
            return outline || style.boxShadow !== "none";
          });
        }),
      { message: "the focused control shows where focus is" },
    )
    .toBe(true);
}

/**
 * Presses Tab, as a keyboard-only learner would, until the control has focus, then checks the focus
 * is visible. Fails when the control can't be reached within a screen's worth of stops.
 */
export async function tabTo(page: Page, target: Locator) {
  // A screen may focus its main field or action on arrival; that counts as reached.
  if (await isFocused(target)) {
    return;
  }

  for (let stop = 0; stop < MAX_TABS; stop += 1) {
    // oxlint-disable-next-line no-await-in-loop -- Each Tab moves focus one stop.
    await page.keyboard.press("Tab");

    // oxlint-disable-next-line no-await-in-loop -- Focus is read after each stop.
    if (await isFocused(target)) {
      // oxlint-disable-next-line no-await-in-loop -- Runs once, on the stop that reached the control.
      await expectVisibleFocus(target);
      return;
    }
  }

  throw new Error(`Tab never reached ${String(target)}`);
}
