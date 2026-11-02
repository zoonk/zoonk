import { expect } from "vitest";
import { type Locator } from "vitest/browser";
import { press } from "./activity-player";

const MAX_TABS = 40;

function isFocused(target: Locator) {
  const element = target.query();
  return element !== null && element === document.activeElement;
}

function expectVisibleFocus(target: Locator) {
  const style = getComputedStyle(target.element());
  const outline = style.outlineStyle !== "none" && style.outlineWidth !== "0px";

  expect(outline || style.boxShadow !== "none", "the focused control shows where focus is").toBe(
    true,
  );
}

export async function tabTo(target: Locator) {
  await expect.element(target).toBeVisible();

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
