import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { pressOnPage } from "../_test-utils/activity-player";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { isReadStep } from "../lesson/_utils/lesson-steps";
import { previewEntries } from "../preview/preview-catalog";
import { buildLesson } from "../preview/preview-lesson";
import { explanationStep } from "../preview/preview-steps";

/**
 * The arrow keys turn every screen the player shows, the way a swipe does: the left arrow goes
 * back, and the right arrow reads on where the screen reads on, while a question waiting for its
 * answer stays until it's checked.
 */

/** More than a worked example's steps, each of which the right arrow reveals first. */
const MAX_REVEALS = 10;
const BEFORE = { text: "This screen comes first.", title: "Before" };
const AFTER = { text: "This screen comes next.", title: "After" };

function heading(text: string) {
  return page.getByRole("heading", { exact: true, name: text });
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

describe("turning every screen with the arrow keys", () => {
  it.each(cases)("%s", async (_name, entry, state) => {
    const screen = entry.screen(state);

    renderLessonPlayer({
      lesson: buildLesson([explanationStep(BEFORE), screen, explanationStep(AFTER)]),
    });

    await expect.element(heading(BEFORE.title)).toBeVisible();
    await pressOnPage("ArrowRight");
    await expect.element(heading(BEFORE.title)).not.toBeInTheDocument();

    await expectRightArrow({ readsOn: isReadStep(screen) });
    await pressOnPage("ArrowLeft");
    await expect.element(heading(BEFORE.title)).toBeVisible();
  });
});
