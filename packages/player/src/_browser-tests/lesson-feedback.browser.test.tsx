import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { press } from "../_test-utils/activity-player";
import { teachingStep } from "../_test-utils/lesson-steps";
import {
  buildAdapters,
  buildLesson,
  renderLessonPlayer,
  startedRun,
} from "../_test-utils/render-lesson-player";

/**
 * What a learner sees after answering, and the quiet controls around it: one why and one line on
 * what happens next, Hyperdrive from three in a row, "I already know this" in the menu with a miss
 * coming back at the end, Previous on every screen after the first, and Enter going on after a
 * sheet closes.
 */

const QUESTION = 'What does the electron "cloud" show?';
const RIGHT_OPTION = "Where the electron is most likely to be found";
const WRONG_OPTION = "The electron's exact path";

function verdict(text: string) {
  return page.getByRole("status").filter({ hasText: text });
}

async function answer(option: string, expected: string, button = /^Check/u) {
  await page.getByRole("radio", { name: option }).click();
  await page.getByRole("button", { name: button }).click();
  await expect.element(verdict(expected)).toBeVisible();
}

async function next(label = /^Continue/u) {
  await page.getByRole("button", { name: label }).click();
}

describe("lesson feedback", () => {
  it("shows the verdict and one why, with one line on what happens next", async () => {
    const lesson = buildLesson([teachingStep("check"), teachingStep("check")]);
    renderLessonPlayer({ lesson });

    await answer(RIGHT_OPTION, "Correct!");

    await expect
      .element(page.getByText("The cloud shows chances, not a path.", { exact: false }))
      .toBeVisible();

    // The options already show the pick and the answer: nothing repeats them.
    await expect.element(page.getByText("You chose:")).not.toBeInTheDocument();
    await expect.element(page.getByText("Answer:")).not.toBeInTheDocument();

    await next();
    await answer(WRONG_OPTION, "Not quite");

    const notes = page.getByRole("paragraph").filter({ hasText: "Saved to your mistakes" });

    await expect
      .element(notes)
      .toHaveTextContent("Saved to your mistakes · back at the end of this lesson");

    await expect
      .element(page.getByText("This question comes back at the end of the lesson"))
      .not.toBeInTheDocument();
  });

  it("shows Hyperdrive quietly from three right answers in a row, counting the session's streak", async () => {
    const lesson = buildLesson([
      teachingStep("check"),
      teachingStep("check"),
      teachingStep("check"),
    ]);

    renderLessonPlayer({
      adapters: buildAdapters(lesson, {
        startLesson: () =>
          Promise.resolve(startedRun({ hyperdrive: { knownStepIds: [], streak: 1 } })),
      }),
      lesson,
    });

    await answer(RIGHT_OPTION, "Correct!");
    await expect.element(page.getByText("2 right in a row")).not.toBeInTheDocument();

    await next();
    await answer(RIGHT_OPTION, "Correct!");
    await expect.element(page.getByText("3 right in a row")).toBeVisible();

    await next();
    await answer(WRONG_OPTION, "Not quite");
    await expect.element(page.getByText(/in a row/u)).not.toBeInTheDocument();
  });

  it('keeps "I already know this" in the menu and brings a missed check back at the end', async () => {
    const lesson = buildLesson([
      teachingStep("explanation"),
      teachingStep("check"),
      teachingStep("summary"),
    ]);

    renderLessonPlayer({ lesson });

    await expect.element(page.getByText("A cloud, not a little ball")).toBeVisible();

    await expect
      .element(page.getByRole("button", { name: "I already know this" }))
      .not.toBeInTheDocument();

    await page.getByRole("button", { name: "Screen options" }).click();
    await page.getByRole("menuitem", { name: "I already know this" }).click();

    await expect.element(page.getByText("Quick check · 1 of 1")).toBeVisible();
    await answer(WRONG_OPTION, "Not quite");
    await next();

    // Back where the learner was, without a banner; the missed check waits for the end.
    await expect.element(page.getByText("A cloud, not a little ball")).toBeVisible();
    await expect.element(page.getByText("Let's go through it together")).not.toBeInTheDocument();
    await next(/^Next/u);
    await expect.element(page.getByRole("heading", { name: "Summary" })).toBeVisible();
    await next(/^Next/u);

    await expect.element(page.getByText(QUESTION)).toBeVisible();
    await expect.element(page.getByText("Quick check", { exact: false })).not.toBeInTheDocument();

    await expect
      .element(page.getByRole("button", { name: "Explain first" }))
      .not.toBeInTheDocument();

    await answer(RIGHT_OPTION, "Correct!");
    await next();

    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
  });

  it("has Previous on every screen after the first, back to an answered question's result", async () => {
    const lesson = buildLesson([
      teachingStep("hook"),
      teachingStep("explanation"),
      teachingStep("check"),
    ]);

    renderLessonPlayer({ lesson });

    const previous = page.getByRole("button", { name: "Previous screen" });
    await expect.element(previous).not.toBeInTheDocument();

    await answer("No", "Good guess!", /^See the answer/u);
    await next();
    await expect.element(previous).toBeVisible();
    await next(/^Next/u);
    await expect.element(page.getByText(QUESTION)).toBeVisible();
    await expect.element(previous).toBeVisible();

    await previous.click();
    await expect.element(page.getByText("A cloud, not a little ball")).toBeVisible();
    await previous.click();
    await expect.element(verdict("Good guess!")).toBeVisible();
    await expect.element(previous).not.toBeInTheDocument();
  });

  it("goes on with Enter after the summary sheet opened from the menu closes", async () => {
    const lesson = buildLesson([teachingStep("explanation"), teachingStep("check")], {
      summaryIdeas: ["The electron is a cloud of chances."],
    });

    renderLessonPlayer({ lesson });

    await page.getByRole("button", { name: "Screen options" }).click();
    await page.getByRole("menuitem", { name: "Lesson summary" }).click();

    const sheet = page.getByRole("dialog", { name: "Lesson summary" });
    await sheet.getByRole("button", { name: "Got it" }).click();
    await expect.element(sheet).not.toBeInTheDocument();

    await press("Enter");
    await expect.element(page.getByText(QUESTION)).toBeVisible();
    await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
  });
});
