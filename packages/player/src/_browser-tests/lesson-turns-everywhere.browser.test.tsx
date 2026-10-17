import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { pressOnPage } from "../_test-utils/activity-player";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { isReadStep } from "../lesson/_utils/lesson-steps";
import { previewEntries } from "../preview/preview-catalog";
import { buildLesson } from "../preview/preview-lesson";
import { explanationStep } from "../preview/preview-steps";

/**
 * Every screen the player shows turns with the arrow keys and with a swipe: the left arrow and a
 * swipe right from the screen's text go back, and the right arrow reads on where the screen reads
 * on, while a question waiting for its answer stays until it's checked. A finger's own gestures
 * (scrolling, controls that keep their swipe, a quick flick read late) are played with real touches
 * in lesson-swipe.touch.browser.test.tsx; here the swipe is the touch events the page reads, at
 * whatever a finger would land on, which the swipe hook alone decides about.
 */

/** More than a worked example's steps, each of which the right arrow reveals first. */
const MAX_REVEALS = 10;
const BEFORE = { text: "This screen comes first.", title: "Before" };
const AFTER = { text: "This screen comes next.", title: "After" };
const SWIPE_PX = 160;

/**
 * A heading of the screen in view, in the lesson's content: from `lg` the aside's "From the lesson"
 * repeats the last reading screen's title beside a question.
 */
function heading(text: string) {
  return page
    .getByRole("main", { name: "Lesson content" })
    .getByRole("heading", { exact: true, name: text });
}

/** The screen's text, top to bottom: where a learner's finger lands to turn the screen. */
function textOnScreen(): Element[] {
  const screen = document.querySelector("[data-slot='lesson-screen']");

  return [...(screen?.querySelectorAll("h1, h2, h3, p") ?? [])].filter((element) => {
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  });
}

/** A quick swipe right as the page reads it, from whatever a finger touches at the text's center. */
function swipeRightFrom(text: Element) {
  text.scrollIntoView({ behavior: "instant", block: "center" });
  const box = text.getBoundingClientRect();
  const [x, y] = [box.left + box.width / 2, box.top + box.height / 2];
  const target = document.elementFromPoint(x, y) ?? text;
  const start = new Touch({ clientX: x, clientY: y, identifier: 1, target });
  const end = new Touch({ clientX: x + SWIPE_PX, clientY: y, identifier: 1, target });
  const touches = { bubbles: true, cancelable: true };

  target.dispatchEvent(
    new TouchEvent("touchstart", { ...touches, changedTouches: [start], touches: [start] }),
  );

  target.dispatchEvent(new TouchEvent("touchend", { ...touches, changedTouches: [end] }));
}

function nextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(resolve);
  });
}

/** Some of the screen's text turns it back with a swipe: a finger always has somewhere to swipe. */
async function swipeBack() {
  for (const text of textOnScreen()) {
    swipeRightFrom(text);
    // oxlint-disable-next-line no-await-in-loop -- The screen turns before the next try.
    await nextFrame();

    if (heading(BEFORE.title).query()) {
      return;
    }
  }

  await expect.element(heading(BEFORE.title)).toBeVisible();
}

async function readOnUntil(title: string) {
  for (const _ of Array.from({ length: MAX_REVEALS })) {
    if (heading(title).query()) {
      return;
    }

    // oxlint-disable-next-line no-await-in-loop -- Each press shows one more step.
    await pressOnPage("ArrowRight");
  }

  await expect.element(heading(title)).toBeVisible();
}

/**
 * A reading screen reads on to the next one (and the left arrow comes back to it); a question
 * waiting for its answer stays where it is.
 */
async function expectRightArrow({ readsOn }: { readsOn: boolean }) {
  if (readsOn) {
    await readOnUntil(AFTER.title);
    await pressOnPage("ArrowLeft");
  } else {
    await pressOnPage("ArrowRight");
  }

  await expect.element(heading(AFTER.title)).not.toBeInTheDocument();
}

const cases = previewEntries.flatMap((entry) =>
  entry.states
    .filter((state) => state !== "checked")
    .map((state) => [`${entry.id} (${state})`, entry, state] as const),
);

describe("turning every screen", () => {
  it.each(cases)("%s", async (_name, entry, state) => {
    const screen = entry.screen(state);

    renderLessonPlayer({
      lesson: buildLesson([explanationStep(BEFORE), screen, explanationStep(AFTER)]),
    });

    await expect.element(heading(BEFORE.title)).toBeVisible();
    await pressOnPage("ArrowRight");
    await expect.element(heading(BEFORE.title)).not.toBeInTheDocument();

    await swipeBack();
    await pressOnPage("ArrowRight");
    await expect.element(heading(BEFORE.title)).not.toBeInTheDocument();

    await expectRightArrow({ readsOn: isReadStep(screen) });
    await pressOnPage("ArrowLeft");
    await expect.element(heading(BEFORE.title)).toBeVisible();
  });
});
