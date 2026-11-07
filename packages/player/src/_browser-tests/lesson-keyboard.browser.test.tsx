import { act } from "@testing-library/react";
import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { afterEach, describe, expect, it, vi } from "vitest";
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
import {
  type LessonPlayerAdapters,
  type PlayableLanguageStep,
  type PlayableLibraryStep,
} from "../lesson/lesson-player-types";
import { buildLesson } from "../preview/preview-lesson";
import {
  activityStep,
  explanationStep,
  languageStep,
  spokenAnswerStep,
  teachingStep,
} from "../preview/preview-steps";

const DESKTOP = { height: 900, width: 1280 };
const TABLET_WITH_KEYBOARD = { height: 1180, width: 820 };
const SHORT_DESKTOP = { height: 450, width: 1440 };
const SMALL_PHONE = { height: 700, width: 320 };
const RIGHT_TYPED = "It shows where the electron is likely to be";
const SUMMARY_IDEA = "Electrons live in clouds.";

function openLesson({ steps }: { steps: PlayableLibraryStep[] }) {
  return renderLessonPlayer({
    lesson: buildLesson(steps, { summary: { ideas: [{ text: SUMMARY_IDEA }], shape: "hub" } }),
  });
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

function listeningWithAudio(): PlayableLanguageStep {
  const step = languageStep("listening");
  const { sentence } = step.exercise;

  if (!sentence) {
    throw new Error("The listening step has no sentence");
  }

  return {
    ...step,
    exercise: {
      ...step.exercise,
      sentence: { ...sentence, audioUrl: "https://audio.zoonk.test/sentence.mp3" },
    },
  };
}

function countPlays() {
  const plays = vi.fn();

  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function play(
    this: HTMLMediaElement,
  ) {
    plays();
    setTimeout(() => this.dispatchEvent(new Event("ended")), 0);
    return Promise.resolve();
  });

  return plays;
}

describe("lesson by keyboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("a focused control keeps Enter, and a menu or a sheet holds the lesson's keys", async () => {
    await atViewport(TABLET_WITH_KEYBOARD, async () => {
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
      await expect.element(page.getByRole("heading", { name: "Lesson map" })).toBeVisible();
      await press("ArrowLeft");
      await expect.element(verdict("Correct!")).toBeVisible();
      await press("Enter");
      await expect.element(page.getByRole("heading", { name: "Lesson map" })).toBeVisible();
      await press("Enter");
      await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

      await tabTo(page.getByRole("button", { name: "Screen options" }));
      await press("Enter");

      const summaryItem = page.getByRole("menuitem", { name: "Lesson map" });
      await press("End");
      await expect.element(summaryItem).toHaveFocus();
      await press("Enter");

      const summary = page.getByRole("dialog", { name: "Lesson map" });
      await expect.element(summary.getByText(SUMMARY_IDEA)).toBeVisible();
      await press("Escape");
      await expect.element(summary).not.toBeInTheDocument();
      await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
    });
  });

  it("the lesson end's map in the aside takes the keyboard and scrolls with Page Down", async () => {
    await atViewport(SHORT_DESKTOP, async () => {
      const ideas = Array.from({ length: 10 }, (_, index) => ({
        label: `Idea ${index + 1}`,
        text: `Idea ${index + 1} explains one more part of where an electron is likely to be.`,
      }));

      renderLessonPlayer({
        lesson: buildLesson([teachingStep("check")], { summary: { ideas, shape: "hub" } }),
      });

      await press("2");
      await press("Enter");
      await expect.element(verdict("Correct!")).toBeVisible();
      await press("Enter");
      await press("Enter");
      await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

      const map = page.getByRole("region", { name: "Lesson map" });
      await tabTo(map);
      expect(map.element().scrollTop).toBe(0);

      await press("PageDown");
      await expect.poll(() => map.element().scrollTop).toBeGreaterThan(0);
    });
  });

  it("a formula wider than its column takes Tab and scrolls with the arrows instead of turning the screen", async () => {
    await atViewport(SMALL_PHONE, async () => {
      const worked = teachingStep("workedExample");

      openLesson({
        steps: [
          {
            ...worked,
            content: {
              ...worked.content,
              steps: [
                {
                  math: String.raw`1.200{,}00 + 600{,}00 + 250{,}00 = 2.050{,}00`,
                  text: "Add the three bills.",
                },
                { math: "a + b = c", text: "A line that fits." },
              ],
            },
          },
          teachingStep("check"),
        ],
      });

      await press("Enter");
      await expect.element(page.getByText("A line that fits.")).toBeVisible();

      const stops = document.querySelectorAll("[data-slot='display-math'] > [tabindex]");
      expect(stops).toHaveLength(1);

      const formula = page.elementLocator(stops[0]!);
      await tabTo(formula);
      expect(formula.element().scrollLeft).toBe(0);

      await press("ArrowRight");

      await expect.poll(() => formula.element().scrollLeft).toBeGreaterThan(0);
      await expect.element(page.getByText("A line that fits.")).toBeVisible();
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

  it("a turn keeps keyboard focus on the button pressed, or on Continue where the next screen has none, and leaves a pointer's focus alone", async () => {
    await atViewport(DESKTOP, async () => {
      openLesson({
        steps: [
          teachingStep("check"),
          explanationStep({ text: "Electrons spread out.", title: "First idea" }),
          explanationStep({ text: "Clouds show chances.", title: "Second idea" }),
        ],
      });

      const previous = page.getByRole("button", { name: "Previous screen" });
      const primary = page.getByRole("button", { name: /^(?:Next|Continue)/u });

      await press("2");
      await press("Enter");
      await expect.element(verdict("Correct!")).toBeVisible();
      await press("Enter");
      await expect.element(page.getByRole("heading", { name: "First idea" })).toBeVisible();

      await tabTo(primary);
      await press("Enter");
      await expect.element(page.getByRole("heading", { name: "Second idea" })).toBeVisible();
      await expect.element(primary).toHaveFocus();

      await tabTo(previous);
      await press("Enter");
      await expect.element(page.getByRole("heading", { name: "First idea" })).toBeVisible();
      await expect.element(previous).toHaveFocus();

      await press("Enter");
      await expect.element(verdict("Correct!")).toBeVisible();
      await expect.element(primary).toHaveFocus();

      await press("ArrowRight");
      await expect.element(page.getByRole("heading", { name: "First idea" })).toBeVisible();
      await expect.element(primary).toHaveFocus();

      await previous.click();
      await expect.element(verdict("Correct!")).toBeVisible();
      await expect.element(primary).not.toHaveFocus();
    });
  });

  it("a key that turns onto an unanswered question lands on its Check, which takes focus before it can run", async () => {
    await atViewport(DESKTOP, async () => {
      openLesson({
        steps: [
          explanationStep({ text: "Electrons spread out.", title: "First idea" }),
          teachingStep("check"),
        ],
      });

      await tabTo(page.getByRole("button", { name: /^Next/u }));
      await press("Enter");

      await expect.element(page.getByRole("radiogroup")).toBeVisible();
      await expect.element(page.getByRole("button", { name: /^Check/u })).toHaveFocus();
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
    const check = page.getByRole("button", { exact: true, name: "Check" });
    await check.click();
    await expect.poll(() => checkStep.mock.calls.length).toBe(1);
    await expect.element(check).toHaveAttribute("aria-busy", "true");
    await expect.element(check).toBeDisabled();
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

  it.each<[string, () => PlayableLibraryStep]>([
    ["a listening step", listeningWithAudio],
    [
      "a spoken step answered by listening",
      () => ({ ...spokenAnswerStep(), listening: listeningWithAudio().exercise }),
    ],
  ])(
    "%s plays as it shows; Enter on its play button checks the answer, playing only while there's nothing to check, and P plays",
    async (_, step) => {
      await atViewport(DESKTOP, async () => {
        const plays = countPlays();

        renderLessonPlayer({
          lesson: buildLesson([step(), teachingStep("summary")], {
            language: "pt",
            targetLanguage: "en",
          }),
        });

        const play = page.getByRole("button", { name: "Play pronunciation" });

        await expect.poll(() => plays.mock.calls.length).toBeGreaterThan(0);
        await expect.element(play).toBeVisible();
        const shown = plays.mock.calls.length;

        await pressEnterOn(play);
        await expect.poll(() => plays.mock.calls.length).toBe(shown + 1);

        for (const word of ["Quanto", "é", "o", "aluguel?"]) {
          // oxlint-disable-next-line no-await-in-loop -- The words go in one at a time, in order.
          await bankTile(word).click();
        }

        await play.click();
        await expect.poll(() => plays.mock.calls.length).toBe(shown + 2);
        await expect.element(play).toHaveFocus();

        await press("Enter");
        await expect.element(verdict("Correct!")).toBeVisible();

        await press("p");
        await expect.poll(() => plays.mock.calls.length).toBe(shown + 3);

        document.body.dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "P" }),
        );

        await expect.poll(() => plays.mock.calls.length).toBe(shown + 4);

        await press("Enter");
        await expect.element(page.getByRole("heading", { name: "Summary" })).toBeVisible();
        expect(plays).toHaveBeenCalledTimes(shown + 4);
      });
    },
  );

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
