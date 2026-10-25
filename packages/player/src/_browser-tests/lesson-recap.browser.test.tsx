import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { atViewport } from "../_test-utils/browser-viewport";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { contentStep, explanationStep } from "../preview/preview-steps";

/**
 * "From the lesson" beside a question on a wide screen (folded under it on a phone), and the
 * sentence it marks there after a wrong answer: the one the question rests on, when the recap shows
 * that screen. Lessons written before questions had a basis show the recap as they always did.
 */

const RIGHT_OPTION = "Where the electron is most likely to be found";
const WRONG_OPTION = "The electron's exact path";
const RESTS_ON = "It spreads out into a **cloud of possibilities**: a map of where it might be.";
const MARKED = "It spreads out into a cloud of possibilities: a map of where it might be.";
const PHONE = { height: 844, width: 390 };

function aside() {
  return page.getByRole("complementary", { name: "Help with this screen" });
}

/** The words the recap marks, or null when it marks none. */
function markedText(): string | null {
  return aside().element().querySelector("mark")?.textContent ?? null;
}

/** The title of the screen the phone's folded recap shows, while it's open. */
function phoneRecapTitle(): string | null {
  const titles = document.querySelectorAll('[data-slot="lesson-recap-row"] h3');
  return [...titles].find((title) => title.checkVisibility())?.textContent ?? null;
}

/** A question on the electron cloud, resting on a sentence of the screen at `position`. */
function question(basis?: { position: number; quote: string }) {
  return contentStep("check", {
    content: { ...playableStepContent.check, ...(basis ? { basis } : {}) },
  });
}

async function answer(option: string, verdict: string) {
  await page.getByRole("radio", { name: option }).click();
  await page.getByRole("button", { name: /^Check/u }).click();
  await expect.element(page.getByRole("status").filter({ hasText: verdict })).toBeVisible();
}

describe("lesson recap", () => {
  it("marks the sentence a missed question rests on, and nothing before the answer", async () => {
    const lesson = buildLesson([
      explanationStep(playableStepContent.explanation),
      question({ position: 0, quote: RESTS_ON }),
    ]);

    renderLessonPlayer({ lesson });
    await page.getByRole("button", { name: /^Next/u }).click();

    await expect.element(aside().getByText("From the lesson")).toBeVisible();
    expect(markedText()).toBeNull();

    await answer(WRONG_OPTION, "Not quite");

    await expect.poll(markedText).toBe(MARKED);
    await expect.element(aside().getByText("A cloud, not a little ball")).toBeVisible();
  });

  it("marks nothing after a right answer", async () => {
    const lesson = buildLesson([
      explanationStep(playableStepContent.explanation),
      question({ position: 0, quote: RESTS_ON }),
    ]);

    renderLessonPlayer({ lesson });
    await page.getByRole("button", { name: /^Next/u }).click();
    await answer(RIGHT_OPTION, "Correct!");

    await expect.element(aside().getByText("From the lesson")).toBeVisible();
    expect(markedText()).toBeNull();
  });

  it("marks nothing for a question without a basis, or one resting on another screen", async () => {
    const lesson = buildLesson([
      explanationStep(playableStepContent.explanation),
      question(),
      explanationStep({ text: "Where the cloud is densest, the electron is likeliest." }),
      question({ position: 0, quote: RESTS_ON }),
    ]);

    renderLessonPlayer({ lesson });
    await page.getByRole("button", { name: /^Next/u }).click();

    // A lesson written before questions had a basis: the recap as it always was.
    await answer(WRONG_OPTION, "Not quite");
    await expect.element(aside().getByText("A cloud, not a little ball")).toBeVisible();
    expect(markedText()).toBeNull();

    await page.getByRole("button", { name: /^Continue/u }).click();
    await page.getByRole("button", { name: /^Next/u }).click();

    // The recap shows the screen just read, not the one the question rests on.
    await answer(WRONG_OPTION, "Not quite");
    await expect.element(aside().getByText("Where the cloud is densest")).toBeVisible();
    expect(markedText()).toBeNull();
  });

  it("recaps a missed question coming back at the end with the screen read before its place", async () => {
    const lesson = buildLesson([
      explanationStep(playableStepContent.explanation),
      question(),
      explanationStep({ text: "Where the cloud is densest, the electron is likeliest." }),
      question(),
    ]);

    renderLessonPlayer({ lesson });
    await page.getByRole("button", { name: /^Next/u }).click();
    await answer(WRONG_OPTION, "Not quite");
    await page.getByRole("button", { name: /^Continue/u }).click();
    await page.getByRole("button", { name: /^Next/u }).click();
    await answer(RIGHT_OPTION, "Correct!");
    await page.getByRole("button", { name: /^Continue/u }).click();

    // The missed question is back at the end: the recap is the screen before it the first time.
    await expect.element(page.getByRole("radio", { name: WRONG_OPTION })).not.toBeChecked();
    await expect.element(aside().getByText("A cloud, not a little ball")).toBeVisible();
    await expect.element(aside().getByText("screen 1")).toBeVisible();
    await expect.element(aside().getByText("Where the cloud is densest")).not.toBeInTheDocument();
  });

  it('recaps a check missed in "I already know this" with the screen before its place', async () => {
    const lesson = buildLesson([
      explanationStep(playableStepContent.explanation),
      question(),
      explanationStep({ text: "Where the cloud is densest, the electron is likeliest." }),
      question(),
    ]);

    renderLessonPlayer({ lesson });
    await page.getByRole("button", { name: "Screen options" }).click();
    await page.getByRole("menuitem", { name: "I already know this" }).click();
    await answer(WRONG_OPTION, "Not quite");
    await page.getByRole("button", { name: /^Continue/u }).click();

    // Back on the first screen: the missed check left its place for the end, after screen 2.
    await page.getByRole("button", { name: /^Next/u }).click();
    await page.getByRole("button", { name: /^Next/u }).click();
    await answer(RIGHT_OPTION, "Correct!");
    await page.getByRole("button", { name: /^Continue/u }).click();

    await expect.element(page.getByRole("radio", { name: WRONG_OPTION })).not.toBeChecked();
    await expect.element(aside().getByText("A cloud, not a little ball")).toBeVisible();
    await expect.element(aside().getByText("screen 1")).toBeVisible();
    await expect.element(aside().getByText("Where the cloud is densest")).not.toBeInTheDocument();
  });

  // A phone had no way to look back at the lesson from a question but leaving it for the screens
  // before, which the wide screens' aside shows beside it.
  it("folds the recap under a phone's question, opening in place with the sentence marked", async () => {
    await atViewport(PHONE, async () => {
      const lesson = buildLesson([
        explanationStep(playableStepContent.explanation),
        question({ position: 0, quote: RESTS_ON }),
      ]);

      renderLessonPlayer({ lesson });
      await page.getByRole("button", { name: /^Next/u }).click();

      const recap = page.getByRole("button", { name: /^From the lesson/u });

      await expect.element(recap).toHaveAttribute("aria-expanded", "false");
      expect(phoneRecapTitle()).toBeNull();

      await answer(WRONG_OPTION, "Not quite");
      await recap.click();

      await expect.element(recap).toHaveAttribute("aria-expanded", "true");
      await expect.poll(phoneRecapTitle).toBe("A cloud, not a little ball");
      await expect.element(page.getByRole("radio", { name: WRONG_OPTION })).toBeInTheDocument();

      const marked = [...document.querySelectorAll("mark")].find((mark) => mark.checkVisibility());
      expect(marked?.textContent).toBe(MARKED);
    });
  });
});
