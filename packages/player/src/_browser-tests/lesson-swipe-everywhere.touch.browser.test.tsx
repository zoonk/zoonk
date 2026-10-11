import { type PlayableLibraryStep } from "@zoonk/core/lesson-player/contract";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { swipeFrom } from "../_test-utils/touch-screen";
import { isReadStep } from "../lesson/_utils/lesson-steps";
import { previewEntries } from "../preview/preview-catalog";
import { buildLesson } from "../preview/preview-lesson";
import { explanationStep } from "../preview/preview-steps";

/**
 * Every screen the player shows turns with a finger the same way (the touch instance in
 * vitest.config.mts): a quick swipe right goes back and, where the screen reads on, a swipe left
 * goes forward, wherever the swipe starts outside the screen's own controls. A sideways gesture
 * that belongs to a control (a slider, a handle to drag, a chip, a key, a field, a wide table or
 * a line of code that scrolls) stays with it and never turns the screen.
 */

const SWIPE_PX = 160;
/** More than a worked example's steps, each of which a swipe on reveals first. */
const MAX_REVEALS = 10;
const BEFORE = { text: "This screen comes first.", title: "Before" };
const AFTER = { text: "This screen comes next.", title: "After" };

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

/**
 * Up to three of the screen's own gesture targets, spread from its top to its bottom: controls a
 * finger can really touch (a disabled button lets touches through to the page, like a phone).
 */
function ownGestureTargets(): Element[] {
  const targets = [...shownScreen().querySelectorAll("*")].filter(
    (element) =>
      isShown(element) && handlesOwnTouch(element) && element.contains(touchedAt(element)),
  );

  const picks = [targets[0], targets[Math.floor(targets.length / 2)], targets.at(-1)];
  return [...new Set(picks.filter((element) => element !== undefined))];
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

/** Reads on until the next screen: a worked example shows its next step with each swipe first. */
async function swipeOnUntil(title: string) {
  for (const _ of Array.from({ length: MAX_REVEALS })) {
    if (heading(title).query()) {
      return;
    }

    // oxlint-disable-next-line no-await-in-loop -- Each swipe shows one more step.
    await swipe(neutralSpot(), -SWIPE_PX);
  }

  await expect.element(heading(title)).toBeVisible();
}

function heading(text: string) {
  return page.getByRole("heading", { exact: true, name: text });
}

async function expectStillOnScreen() {
  await expect.element(heading(BEFORE.title)).not.toBeInTheDocument();
  await expect.element(heading(AFTER.title)).not.toBeInTheDocument();
}

function playBetween(screen: PlayableLibraryStep) {
  renderLessonPlayer({
    lesson: buildLesson([explanationStep(BEFORE), screen, explanationStep(AFTER)]),
  });
}

/**
 * Reading screens move on with a swipe left (and a swipe right comes back to them); a question
 * waiting for its answer stays where it is.
 */
async function expectSwipeLeft({ readsOn }: { readsOn: boolean }) {
  if (readsOn) {
    await swipeOnUntil(AFTER.title);
    await swipe(page.getByText(AFTER.text).element(), SWIPE_PX);
  } else {
    await swipe(neutralSpot(), -SWIPE_PX);
  }

  await expectStillOnScreen();
}

const cases = previewEntries.flatMap((entry) =>
  entry.states
    .filter((state) => state !== "checked")
    .map((state) => [`${entry.id} (${state})`, entry, state] as const),
);

describe("swiping through every screen", () => {
  it.each(cases)("%s", async (_name, entry, state) => {
    const screen = entry.screen(state);
    playBetween(screen);

    await swipe(page.getByText(BEFORE.text).element(), -SWIPE_PX);
    await expect.element(heading(BEFORE.title)).not.toBeInTheDocument();

    for (const target of ownGestureTargets()) {
      // oxlint-disable-next-line no-await-in-loop -- Each gesture lands before the next one.
      await swipe(target, -SWIPE_PX);
      // oxlint-disable-next-line no-await-in-loop -- Same as above.
      await swipe(target, SWIPE_PX);
      // oxlint-disable-next-line no-await-in-loop -- Same as above.
      await expectStillOnScreen();
    }

    await expectSwipeLeft({ readsOn: isReadStep(screen) });
    await swipe(neutralSpot(), SWIPE_PX);
    await expect.element(heading(BEFORE.title)).toBeVisible();
  });
});
