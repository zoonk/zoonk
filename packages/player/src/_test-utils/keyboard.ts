import { expect } from "vitest";
import { type Locator } from "vitest/browser";
import { press } from "./activity-player";

/** More stops than any screen has before its main action; a longer walk means focus is lost. */
const MAX_TABS = 40;

function isFocused(target: Locator) {
  const element = target.query();
  return element !== null && element === document.activeElement;
}

/** Keyboard focus shows as an outline or a ring (a box shadow), never as nothing. */
function expectVisibleFocus(target: Locator) {
  const style = getComputedStyle(target.element());
  const outline = style.outlineStyle !== "none" && style.outlineWidth !== "0px";

  expect(outline || style.boxShadow !== "none", "the focused control shows where focus is").toBe(
    true,
  );
}

/**
 * Presses Tab, as a keyboard-only learner would, until the control has focus, then checks the focus
 * is visible. Fails when the control can't be reached within a screen's worth of stops.
 */
export async function tabTo(target: Locator) {
  await expect.element(target).toBeVisible();

  // A screen may focus its main field or action on arrival; that counts as reached.
  if (isFocused(target)) {
    return;
  }

  for (let stop = 0; stop < MAX_TABS; stop += 1) {
    // oxlint-disable-next-line no-await-in-loop -- Each Tab moves focus one stop.
    await press("Tab");

    if (isFocused(target)) {
      expectVisibleFocus(target);
      return;
    }
  }

  throw new Error(`Tab never reached ${target.selector}`);
}
