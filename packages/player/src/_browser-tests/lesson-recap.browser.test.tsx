import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { atViewport } from "../_test-utils/browser-viewport";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { contentStep, explanationStep } from "../preview/preview-steps";

/**
 * "From the lesson" beside a question on a wide screen, and the sentence it marks there after a
 * wrong answer: the one the question rests on, when the recap shows that screen. Lessons written
 * before questions had a basis show the recap as they always did.
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

  it("keeps a phone's screen as it was: the recap and its mark are wide screens' only", async () => {
    await atViewport(PHONE, async () => {
      const lesson = buildLesson([
        explanationStep(playableStepContent.explanation),
        question({ position: 0, quote: RESTS_ON }),
      ]);

      renderLessonPlayer({ lesson });
      await page.getByRole("button", { name: /^Next/u }).click();
      await answer(WRONG_OPTION, "Not quite");

      await expect.element(page.getByText("From the lesson")).not.toBeVisible();
      expect(document.querySelector("mark")?.checkVisibility() ?? false).toBe(false);
    });
  });
});
