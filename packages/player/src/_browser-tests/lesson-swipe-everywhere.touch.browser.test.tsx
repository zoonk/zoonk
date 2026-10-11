import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { swipeFrom } from "../_test-utils/touch-screen";
import { previewEntries } from "../preview/preview-catalog";
import { buildLesson } from "../preview/preview-lesson";
import { explanationStep } from "../preview/preview-steps";

/**
 * Every screen the player shows turns with a finger (the touch instance in vitest.config.mts): a
 * swipe left reads on to it, and a swipe right from somewhere outside its controls goes back. The
 * arrow keys read on through every screen in lesson-arrows-everywhere.browser.test.tsx, and a swipe
 * that starts on a control stays with it in lesson-swipe.touch.browser.test.tsx.
 */

const SWIPE_PX = 160;
const BEFORE = { text: "This screen comes first.", title: "Before" };

/** Controls and content that keep their own touch, as the swipe hook reads them. */
const OWN_GESTURE = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "[contenteditable='true']",
  "[draggable='true']",
  "[role='button']",
  "[role='slider']",
].join(",");

function shownScreen(): Element {
  const screen = document.querySelector("[data-slot='lesson-screen']");

  if (!screen) {
    throw new Error("No lesson screen is showing.");
  }

  return screen;
}

function isShown(element: Element): boolean {
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0;
}

/** Touch handling a page leaves to the browser: anything else, an element handles itself. */
const BROWSER_TOUCH_ACTIONS = new Set(["auto", "manipulation"]);
const SCROLLING_OVERFLOWS = new Set(["auto", "scroll"]);

function handlesOwnTouch(element: Element): boolean {
  const { overflowX, touchAction } = getComputedStyle(element);
  const scrolls = element.scrollWidth > element.clientWidth && SCROLLING_OVERFLOWS.has(overflowX);
  return element.matches(OWN_GESTURE) || scrolls || !BROWSER_TOUCH_ACTIONS.has(touchAction);
}

/** What a finger at the element's center touches: the top element there, as a phone sees it. */
function touchedAt(element: Element): Element | null {
  element.scrollIntoView({ behavior: "instant", block: "center" });
  const box = element.getBoundingClientRect();
  return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
}

/** Whether a touch on the element lands on something that keeps its own gestures. */
function landsOnOwnGesture(element: Element): boolean {
  const screen = shownScreen();

  for (let node = touchedAt(element); node && node !== screen; node = node.parentElement) {
    if (handlesOwnTouch(node)) {
      return true;
    }
  }

  return false;
}

/** Text on the screen where a finger touches no control, so a swipe there turns the screen. */
function neutralSpot(): Element {
  const text = [...shownScreen().querySelectorAll("h1, h2, h3, p")].find(
    (element) => isShown(element) && !landsOnOwnGesture(element),
  );

  if (!text) {
    throw new Error("The screen has no text to swipe from.");
  }

  return text;
}

async function swipe(element: Element, x: number) {
  element.scrollIntoView({ behavior: "instant", block: "center" });
  await swipeFrom(page.elementLocator(element), { x });
}

function heading(text: string) {
  return page.getByRole("heading", { exact: true, name: text });
}

const cases = previewEntries.flatMap((entry) =>
  entry.states
    .filter((state) => state !== "checked")
    .map((state) => [`${entry.id} (${state})`, entry, state] as const),
);

describe("swiping through every screen", () => {
  it.each(cases)("%s", async (_name, entry, state) => {
    renderLessonPlayer({ lesson: buildLesson([explanationStep(BEFORE), entry.screen(state)]) });

    await swipe(page.getByText(BEFORE.text).element(), -SWIPE_PX);
    await expect.element(heading(BEFORE.title)).not.toBeInTheDocument();

    await swipe(neutralSpot(), SWIPE_PX);
    await expect.element(heading(BEFORE.title)).toBeVisible();
  });
});
