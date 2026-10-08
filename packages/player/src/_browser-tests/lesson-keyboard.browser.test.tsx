import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it } from "vitest";
import { type Locator, page, userEvent } from "vitest/browser";
import { expectVerdict, focusOn, press } from "../_test-utils/activity-player";
import { atViewport } from "../_test-utils/browser-viewport";
import { tabTo } from "../_test-utils/keyboard";
import { activityStep, teachingStep } from "../_test-utils/lesson-steps";
import {
  acceptedAnswerCheck,
  buildAdapters,
  buildLesson,
  renderLessonPlayer,
} from "../_test-utils/render-lesson-player";
import { type PlayableLibraryStep } from "../lesson/lesson-player-types";

/**
 * The lesson player by keyboard alone, at desktop size: Enter runs the screen's main action from
 * anywhere, yet a focused control keeps its own keys; number keys answer; the arrows move between
 * reading screens; sheets hold the lesson's keys while they're open.
 */

const DESKTOP = { height: 900, width: 1280 };
const PHONE = { height: 812, width: 375 };
const RIGHT_TYPED = "It shows where the electron is likely to be";
const SUMMARY_IDEA = "Electrons live in clouds.";

function openLesson({ steps }: { steps: PlayableLibraryStep[] }) {
  return renderLessonPlayer({ lesson: buildLesson(steps, { summaryIdeas: [SUMMARY_IDEA] }) });
}

/** A screen's verdict, as the player announces it. */
function verdict(text: string) {
  return page.getByRole("status").filter({ hasText: text });
}

/** The element at a CSS selector inside a control, once the control is on screen. */
async function inside(locator: Locator, selector: string) {
  await expect.element(locator).toBeVisible();
  const element = locator.element().querySelector(selector);

  if (!element) {
    throw new Error(`Nothing matches ${selector} inside ${locator.selector}`);
  }

  return page.elementLocator(element);
}

describe("lesson by keyboard", () => {
  it("a focused control keeps Enter, and a sheet holds the lesson's keys", async () => {
    await atViewport(DESKTOP, async () => {
      openLesson({ steps: [teachingStep("explanation"), teachingStep("check")] });
      await expect.element(page.getByText("A cloud, not a little ball")).toBeVisible();

      // Enter on the screen's menu opens it; it doesn't move the lesson on.
      await tabTo(page.getByRole("button", { name: "Screen options" }));
      await press("Enter");

      const summaryItem = page.getByRole("menuitem", { name: "Lesson summary" });
      await expect.element(summaryItem).toBeVisible();
      await press("End");
      await expect.element(summaryItem).toHaveFocus();
      await press("Enter");

      const summary = page.getByRole("dialog", { name: "Lesson summary" });
      await expect.element(summary.getByText(SUMMARY_IDEA)).toBeVisible();

      // The arrows wait while the sheet is open, and Escape closes only the sheet, handing focus
      // to Next rather than the menu, so Enter would go on instead of opening it again.
      await press("ArrowRight");
      await expect.element(summary).toBeVisible();
      await press("Escape");
      await expect.element(summary).not.toBeInTheDocument();
      await expect.element(page.getByRole("button", { name: /^Next/u })).toHaveFocus();
      await expect.element(page.getByText("A cloud, not a little ball")).toBeVisible();

      // Anywhere else, the keys move the lesson: the arrow to the check, a number, then Enter.
      await press("ArrowRight");
      await expect.element(page.getByText('What does the electron "cloud" show?')).toBeVisible();
      await press("2");

      await expect
        .element(page.getByRole("radio", { name: "Where the electron is most likely to be found" }))
        .toBeChecked();

      await press("Enter");
      await expect.element(verdict("Correct!")).toBeVisible();
      await press("Enter");
      await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
    });
  });

  it("a written answer checks and continues with Enter, and Escape stays in the field", async () => {
    await atViewport(DESKTOP, async () => {
      const typedAnswer = teachingStep("typedAnswer");
      const lesson = buildLesson([typedAnswer, teachingStep("summary")]);

      const { onExit } = renderLessonPlayer({
        adapters: buildAdapters(lesson, { checkStep: acceptedAnswerCheck(typedAnswer) }),
        lesson,
      });

      const answer = page.getByRole("textbox", {
        name: "In your own words: why is the electron drawn as a cloud?",
      });

      await answer.click();
      await userEvent.keyboard(RIGHT_TYPED);

      // Escape while typing never leaves the lesson and its answer.
      await press("Escape");
      await expect.element(answer).toHaveValue(RIGHT_TYPED);
      expect(onExit).not.toHaveBeenCalled();

      await focusOn(answer);
      await press("Enter");
      await expect.element(verdict("Correct!")).toBeVisible();
      await press("Enter");
      await expect.element(page.getByRole("heading", { name: "Summary" })).toBeVisible();
    });
  });

  it("the close button holds its Esc hint beside the X, and phones keep the plain X", async () => {
    await atViewport(DESKTOP, async () => {
      openLesson({ steps: [teachingStep("explanation")] });

      const close = page.getByRole("link", { name: "Close lesson" });
      const hint = await inside(close, "kbd");
      await expect.element(hint).toHaveTextContent("Esc");

      const icon = await inside(close, "svg");
      const iconBox = icon.element().getBoundingClientRect();
      const hintBox = hint.element().getBoundingClientRect();

      expect(iconBox.x + iconBox.width).toBeLessThanOrEqual(hintBox.x);

      await page.viewport(PHONE.width, PHONE.height);
      await expect.element(hint).not.toBeVisible();

      const phoneBox = close.element().getBoundingClientRect();
      expect(phoneBox.width).toBe(phoneBox.height);
    });
  });

  it("find the error: a number picks a step and Enter checks it, even with the step in focus", async () => {
    await atViewport(DESKTOP, async () => {
      openLesson({ steps: [activityStep({ content: activityContentFixtures.findError })] });

      const wrongStep = page.getByRole("radio", { name: /Step 2: Down 20%/u });
      await expect.element(wrongStep).toBeVisible();

      await press("2");
      await expect.element(wrongStep).toBeChecked();

      // A step clicked or tabbed to keeps focus; Enter still checks the pick, never drops it.
      await focusOn(wrongStep);
      await press("Enter");
      await expectVerdict("Correct!");
      await expect.element(page.getByText("120 × 0.8 = 96, not 100.")).toBeVisible();
    });
  });

  it("an activity keeps digits in its field, and Enter checks the number", async () => {
    await atViewport(DESKTOP, async () => {
      openLesson({ steps: [activityStep({ content: activityContentFixtures.numberLine })] });

      const value = page.getByRole("textbox", { name: "What is the value?" });
      await value.fill("");
      await userEvent.type(value, "5");
      await expect.element(value).toHaveValue("5");

      await press("Enter");
      await expectVerdict("Correct!");
    });
  });
});
