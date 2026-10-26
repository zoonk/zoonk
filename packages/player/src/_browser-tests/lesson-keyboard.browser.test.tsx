import { act } from "@testing-library/react";
import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { expectVerdict, focusOn, press, pressOnPage } from "../_test-utils/activity-player";
import { atViewport } from "../_test-utils/browser-viewport";
import { tabTo } from "../_test-utils/keyboard";
import {
  acceptedAnswerCheck,
  buildAdapters,
  renderLessonPlayer,
} from "../_test-utils/render-lesson-player";
import { type LessonPlayerAdapters, type PlayableLibraryStep } from "../lesson/lesson-player-types";
import { buildLesson } from "../preview/preview-lesson";
import { activityStep, teachingStep } from "../preview/preview-steps";

/**
 * The lesson player by keyboard alone, at desktop size: Enter runs the screen's main action from
 * anywhere, yet a focused control keeps its own keys; number keys answer; the arrows move between
 * reading screens; menus and sheets hold the lesson's keys while they're open.
 */

const DESKTOP = { height: 900, width: 1280 };
const RIGHT_TYPED = "It shows where the electron is likely to be";
const SUMMARY_IDEA = "Electrons live in clouds.";

function openLesson({ steps }: { steps: PlayableLibraryStep[] }) {
  return renderLessonPlayer({ lesson: buildLesson(steps, { summaryIdeas: [SUMMARY_IDEA] }) });
}

/** A screen's verdict, as the player announces it. */
function verdict(text: string) {
  return page.getByRole("status").filter({ hasText: text });
}

describe("lesson by keyboard", () => {
  it("a focused control keeps Enter, and a menu or a sheet holds the lesson's keys", async () => {
    await atViewport(DESKTOP, async () => {
      openLesson({ steps: [teachingStep("explanation"), teachingStep("check")] });
      await expect.element(page.getByText("A cloud, not a little ball")).toBeVisible();

      // Enter on the screen's menu opens it; it doesn't move the lesson on.
      await tabTo(page.getByRole("button", { name: "Screen options" }));
      await press("Enter");

      const knowThis = page.getByRole("menuitem", { name: "I already know this" });
      await expect.element(knowThis).toBeVisible();
      await press("End");
      await expect.element(knowThis).toHaveFocus();

      // The arrows wait while the menu is open, and Escape closes only the menu, handing focus
      // to Next rather than the menu, so Enter would go on instead of opening it again.
      await press("ArrowRight");
      await expect.element(page.getByRole("menu")).toBeVisible();
      await press("Escape");
      await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
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

      // Once the lesson is done, its summary card opens from the menu and Escape closes only it.
      await tabTo(page.getByRole("button", { name: "Screen options" }));
      await press("Enter");

      const summaryItem = page.getByRole("menuitem", { name: "Lesson summary" });
      await press("End");
      await expect.element(summaryItem).toHaveFocus();
      await press("Enter");

      const summary = page.getByRole("dialog", { name: "Lesson summary" });
      await expect.element(summary.getByText(SUMMARY_IDEA)).toBeVisible();
      await press("Escape");
      await expect.element(summary).not.toBeInTheDocument();
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

      // Once checked, focus leaves the locked field for Continue, and the typing hint goes.
      await expect.element(page.getByRole("button", { name: /^Continue/u })).toHaveFocus();

      await expect
        .element(page.getByText("Press Enter to check, Shift+Enter for a new line."))
        .not.toBeInTheDocument();

      await press("Enter");
      await expect.element(page.getByRole("heading", { name: "Summary" })).toBeVisible();
    });
  });

  it("leaving with a written answer not yet checked asks first, and staying keeps the text", async () => {
    await atViewport(DESKTOP, async () => {
      const lesson = buildLesson([teachingStep("typedAnswer"), teachingStep("summary")]);
      const { onExit } = renderLessonPlayer({ lesson });

      const answer = page.getByRole("textbox", {
        name: "In your own words: why is the electron drawn as a cloud?",
      });

      await answer.click();
      await userEvent.keyboard(RIGHT_TYPED);

      // The X asks before dropping the answer, and keeping it goes back to the text as it was.
      await page.getByRole("button", { name: "Close lesson" }).click();
      const leave = page.getByRole("alertdialog", { name: "Leave for now?" });
      await expect.element(leave).toBeVisible();
      await leave.getByRole("button", { name: "Keep writing" }).click();
      await expect.element(leave).not.toBeInTheDocument();
      await expect.element(answer).toHaveValue(RIGHT_TYPED);
      expect(onExit).not.toHaveBeenCalled();

      // Escape away from the field asks the same, and leaving then leaves.
      await pressOnPage("Escape");
      await expect.element(leave).toBeVisible();
      await leave.getByRole("button", { exact: true, name: "Leave" }).click();
      expect(onExit).toHaveBeenCalledOnce();
    });
  });

  it("a pending written check keeps both exits guarded through failure and releases them after saving", async () => {
    const typedAnswer = teachingStep("typedAnswer");
    const lesson = buildLesson([typedAnswer, teachingStep("summary")]);
    const pending = Promise.withResolvers<Awaited<ReturnType<LessonPlayerAdapters["checkStep"]>>>();

    const checkStep = vi
      .fn<LessonPlayerAdapters["checkStep"]>()
      .mockReturnValueOnce(pending.promise)
      .mockImplementationOnce(acceptedAnswerCheck(typedAnswer));

    const { onExit } = renderLessonPlayer({
      adapters: buildAdapters(lesson, { checkStep }),
      lesson,
    });

    const answer = page.getByRole("textbox", {
      name: "In your own words: why is the electron drawn as a cloud?",
    });

    await answer.fill(RIGHT_TYPED);
    await page.getByRole("button", { exact: true, name: "Check" }).click();
    await expect.poll(() => checkStep.mock.calls.length).toBe(1);
    await expect.element(page.getByRole("button", { name: "Checking" })).toBeDisabled();
    await page.getByRole("button", { name: "Close lesson" }).click();
    const leave = page.getByRole("alertdialog", { name: "Leave for now?" });
    await expect.element(leave).toBeVisible();
    await leave.getByRole("button", { name: "Keep writing" }).click();
    await pressOnPage("Escape");
    await expect.element(leave).toBeVisible();
    await leave.getByRole("button", { name: "Keep writing" }).click();
    expect(onExit).not.toHaveBeenCalled();

    await act(async () => {
      pending.resolve({ status: "failed" });
      await pending.promise;
    });

    await expect.element(answer).toHaveValue(RIGHT_TYPED);
    await page.getByRole("button", { name: "Close lesson" }).click();
    await expect.element(leave).toBeVisible();
    await leave.getByRole("button", { name: "Keep writing" }).click();
    await pressOnPage("Escape");
    await expect.element(leave).toBeVisible();
    await leave.getByRole("button", { name: "Keep writing" }).click();
    expect(onExit).not.toHaveBeenCalled();

    await page.getByRole("button", { exact: true, name: "Check" }).click();
    await expect.element(verdict("Correct!")).toBeVisible();
    await expect.element(page.getByRole("link", { name: "Close lesson" })).toBeVisible();
    await pressOnPage("Escape");
    expect(onExit).toHaveBeenCalledOnce();
    await expect.element(leave).not.toBeInTheDocument();
  });

  it("the close button is a plain X on every size, with Escape as its key", async () => {
    await atViewport(DESKTOP, async () => {
      openLesson({ steps: [teachingStep("explanation")] });

      const close = page.getByRole("link", { name: "Close lesson" });
      await expect.element(close).toHaveAttribute("aria-keyshortcuts", "Escape");
      expect(close.element().querySelector("kbd")).toBeNull();

      const desktopBox = close.element().getBoundingClientRect();
      expect(desktopBox.width).toBe(desktopBox.height);
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
