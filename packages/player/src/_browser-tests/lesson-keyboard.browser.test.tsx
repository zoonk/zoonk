import { act } from "@testing-library/react";
import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it, vi } from "vitest";
import { type Locator, page, userEvent } from "vitest/browser";
import {
  expectCount,
  expectVerdict,
  focusOn,
  press,
  pressOnPage,
} from "../_test-utils/activity-player";
import { atViewport } from "../_test-utils/browser-viewport";
import { tabTo } from "../_test-utils/keyboard";
import {
  acceptedAnswerCheck,
  buildAdapters,
  renderLessonPlayer,
} from "../_test-utils/render-lesson-player";
import { type LessonPlayerAdapters, type PlayableLibraryStep } from "../lesson/lesson-player-types";
import { buildLesson } from "../preview/preview-lesson";
import { activityStep, languageStep, teachingStep } from "../preview/preview-steps";

const DESKTOP = { height: 900, width: 1280 };
const RIGHT_TYPED = "It shows where the electron is likely to be";
const SUMMARY_IDEA = "Electrons live in clouds.";

function openLesson({ steps }: { steps: PlayableLibraryStep[] }) {
  return renderLessonPlayer({ lesson: buildLesson(steps, { summaryIdeas: [SUMMARY_IDEA] }) });
}

function verdict(text: string) {
  return page.getByRole("status").filter({ hasText: text });
}

function bankTile(word: string) {
  return page
    .getByRole("group", { name: "Word bank" })
    .getByRole("button", { exact: true, name: word });
}

function bankWord(index: number) {
  const word = page
    .getByRole("group", { name: "Word bank" })
    .getByRole("button")
    .elements()
    .at(index)
    ?.getAttribute("aria-label");

  if (!word) {
    throw new Error(`The word bank has no word at ${index}`);
  }

  return word;
}

function placedWord(position: number, word: string) {
  return page
    .getByRole("group", { name: "Your answer" })
    .getByRole("button", { exact: true, name: `Position ${position}: ${word}. Tap to remove.` });
}

function pressWithScreenReader(target: Locator) {
  target
    .element()
    .dispatchEvent(
      new PointerEvent("click", { bubbles: true, buttons: 1, detail: 1, pointerType: "mouse" }),
    );
}

async function pressEnterOn(target: Locator) {
  await focusOn(target);
  await press("Enter");
}

describe("lesson by keyboard", () => {
  it("a focused control keeps Enter, and a menu or a sheet holds the lesson's keys", async () => {
    await atViewport(DESKTOP, async () => {
      openLesson({ steps: [teachingStep("explanation"), teachingStep("check")] });
      await expect.element(page.getByText("A cloud, not a little ball")).toBeVisible();

      await tabTo(page.getByRole("button", { name: "Screen options" }));
      await press("Enter");

      const knowThis = page.getByRole("menuitem", { name: "I already know this" });
      await expect.element(knowThis).toBeVisible();
      await press("End");
      await expect.element(knowThis).toHaveFocus();

      await press("ArrowRight");
      await expect.element(page.getByRole("menu")).toBeVisible();
      await press("Escape");
      await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
      await expect.element(page.getByRole("button", { name: /^Next/u })).toHaveFocus();
      await expect.element(page.getByText("A cloud, not a little ball")).toBeVisible();

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

  it("a written answer takes the keyboard on arrival, checks and continues with Enter, and Escape stays in the field", async () => {
    await atViewport(DESKTOP, async () => {
      const typedAnswer = teachingStep("typedAnswer");

      const lesson = buildLesson([
        teachingStep("explanation"),
        typedAnswer,
        teachingStep("summary"),
      ]);

      const { onExit } = renderLessonPlayer({
        adapters: buildAdapters(lesson, { checkStep: acceptedAnswerCheck(typedAnswer) }),
        lesson,
      });

      const answer = page.getByRole("textbox", {
        name: "In your own words: why is the electron drawn as a cloud?",
      });

      await press("Enter");
      await expect.element(answer).toHaveFocus();
      await userEvent.keyboard(RIGHT_TYPED);

      await press("Escape");
      await expect.element(answer).toHaveValue(RIGHT_TYPED);
      expect(onExit).not.toHaveBeenCalled();

      await focusOn(answer);
      await press("Enter");
      await expect.element(verdict("Correct!")).toBeVisible();

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

      await page.getByRole("button", { name: "Close lesson" }).click();
      const leave = page.getByRole("alertdialog", { name: "Leave for now?" });
      await expect.element(leave).toBeVisible();
      await leave.getByRole("button", { name: "Keep writing" }).click();
      await expect.element(leave).not.toBeInTheDocument();
      await expect.element(answer).toHaveValue(RIGHT_TYPED);
      expect(onExit).not.toHaveBeenCalled();

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

  it("a word bank keeps keyboard focus on the words as they go in and come out, and leaves a pointer's focus alone", async () => {
    await atViewport(DESKTOP, async () => {
      renderLessonPlayer({
        lesson: buildLesson(
          [languageStep("reading"), languageStep("fillBlank"), teachingStep("summary")],
          { language: "pt", targetLanguage: "en" },
        ),
      });

      const check = page.getByRole("button", { name: /^Check/u });

      await expect.element(bankTile("rent?")).toBeVisible();

      await bankTile(bankWord(0)).click();
      await expect.element(bankTile(bankWord(1))).not.toHaveFocus();
      await placedWord(1, bankWord(0)).click();
      await expect.element(bankTile(bankWord(0))).not.toHaveFocus();

      pressWithScreenReader(bankTile(bankWord(0)));
      await expect.element(bankTile(bankWord(1))).toHaveFocus();
      pressWithScreenReader(placedWord(1, bankWord(0)));
      await expect.element(bankTile(bankWord(0))).toHaveFocus();

      await tabTo(bankTile(bankWord(0)));
      await press("Enter");
      await expect.element(bankTile(bankWord(1))).toHaveFocus();

      await pressEnterOn(bankTile(bankWord(-1)));
      await expect.element(bankTile(bankWord(-2))).toHaveFocus();
      await press("Enter");
      await expect.element(bankTile(bankWord(-3))).toHaveFocus();

      await pressEnterOn(placedWord(3, bankWord(-2)));
      await expect.element(placedWord(2, bankWord(-1))).toHaveFocus();

      await pressEnterOn(placedWord(1, bankWord(0)));
      await expect.element(placedWord(1, bankWord(-1))).toHaveFocus();
      await press("Enter");
      await expect.element(bankTile(bankWord(-1))).toHaveFocus();

      for (const word of ["How", "much", "is", "the", "rent?"]) {
        // oxlint-disable-next-line no-await-in-loop -- The words go in one at a time, in order.
        await pressEnterOn(bankTile(word));
      }

      await expect.element(check).toHaveFocus();
      await press("Enter");
      await expect.element(verdict("Correct!")).toBeVisible();
      await press("Enter");

      await expect.element(page.getByText("The electron is drawn as a")).toBeVisible();
      await pressEnterOn(bankTile("orbit"));
      await expect.element(check).toHaveFocus();

      await pressEnterOn(page.getByRole("button", { name: "Blank 1: orbit. Tap to remove." }));
      await expect.element(bankTile("orbit")).toHaveFocus();
    });
  });

  it("a held Enter presses a focused button once, so it neither empties the word bank nor skips the feedback", async () => {
    await atViewport(DESKTOP, async () => {
      renderLessonPlayer({
        lesson: buildLesson([languageStep("reading"), teachingStep("summary")], {
          language: "pt",
          targetLanguage: "en",
        }),
      });

      await focusOn(bankTile("How"));
      await userEvent.keyboard("{Shift>}{Enter>8}{/Enter}{/Shift}");
      await expectCount(page.getByRole("group", { name: "Your answer" }).getByRole("button"), 1);

      for (const word of ["much", "is", "the", "rent?"]) {
        // oxlint-disable-next-line no-await-in-loop -- The words go in one at a time, in order.
        await pressEnterOn(bankTile(word));
      }

      await expect.element(page.getByRole("button", { name: /^Check/u })).toHaveFocus();
      await userEvent.keyboard("{Enter>8}{/Enter}");
      await expect.element(verdict("Correct!")).toBeVisible();
      await expect.element(page.getByRole("heading", { name: "Summary" })).not.toBeInTheDocument();
    });
  });

  it("the close button names Escape as its key", async () => {
    openLesson({ steps: [teachingStep("explanation")] });

    await expect
      .element(page.getByRole("link", { name: "Close lesson" }))
      .toHaveAttribute("aria-keyshortcuts", "Escape");
  });

  it("find the error: a number picks a step and Enter checks it, even with the step in focus", async () => {
    await atViewport(DESKTOP, async () => {
      openLesson({ steps: [activityStep({ content: activityContentFixtures.findError })] });

      const wrongStep = page.getByRole("radio", { name: /Step 2: Down 20%/u });
      await expect.element(wrongStep).toBeVisible();

      await press("2");
      await expect.element(wrongStep).toBeChecked();

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
