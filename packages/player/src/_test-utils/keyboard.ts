import { expect } from "vitest";
import { type Locator } from "vitest/browser";
import { press } from "./activity-player";

const MAX_TABS = 40;

/** A locator, or the element itself where nothing but its text could name it (a formula's scroller). */
type TabTarget = HTMLElement | Locator;

function find(target: TabTarget): Element | null {
  return target instanceof HTMLElement ? target : target.query();
}

function isFocused(target: TabTarget) {
  const element = find(target);
  return element !== null && element === document.activeElement;
}

function showsFocus(element: Element | null) {
  if (!element) {
    return false;
  }

  const style = getComputedStyle(element);
  const outline = style.outlineStyle !== "none" && style.outlineWidth !== "0px";

  return outline || style.boxShadow !== "none";
}

/** A scroller that fades its edges draws its ring on its parent, which the fade's mask doesn't clip. */
function expectVisibleFocus(target: TabTarget) {
  const element = find(target);

  if (!element) {
    throw new Error("The focused target left the page");
  }

  expect(
    showsFocus(element) || showsFocus(element.parentElement),
    "the focused control shows where focus is",
  ).toBe(true);
}

export async function tabTo(target: TabTarget) {
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

  const name =
    target instanceof HTMLElement ? `the <${target.localName}> it was given` : target.selector;

  throw new Error(`Tab never reached ${name}`);
}
