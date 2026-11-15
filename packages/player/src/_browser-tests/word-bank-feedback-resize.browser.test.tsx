import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { atViewport } from "../_test-utils/browser-viewport";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { stubTutorApi } from "../_test-utils/tutor-api";
import { buildTutor } from "../_test-utils/tutor-config";
import { buildLesson } from "../preview/preview-lesson";
import { languageStep, teachingStep } from "../preview/preview-steps";

const PHONE = { height: 900, width: 390 };
const LAPTOP = { height: 900, width: 1440 };

const bank = () => page.getByRole("group", { name: "Word bank" });
const feedback = () => page.getByRole("region", { name: "Answer feedback" });
const noThanks = () => page.getByRole("button", { name: "No thanks" });

/** The offer's own Ask button, not the bar's: the one beside its "No thanks". */
function offerAsk(): HTMLButtonElement | null {
  return document.querySelector('[data-slot="lesson-ask-buddy-offer"] button');
}

/** The feedback sits under the bank from `lg` and above it below `lg`, in the page's order too. */
async function feedbackFollowsBank(follows: boolean) {
  await expect
    .poll(() => {
      const position = bank().element().compareDocumentPosition(feedback().element());
      return position === Node.DOCUMENT_POSITION_FOLLOWING;
    })
    .toBe(follows);
}

/** A second miss on a translate step, after a missed question, offers the buddy in the feedback. */
async function missTwiceOnTheBank() {
  const lesson = buildLesson(
    [teachingStep("explanation"), teachingStep("check"), languageStep("reading")],
    { language: "pt", targetLanguage: "en" },
  );

  stubTutorApi({ lesson });
  renderLessonPlayer({ lesson, tutor: buildTutor() });
  await page.getByRole("button", { name: /^Next/u }).click();
  await page.getByRole("radio", { name: "The electron's exact path" }).click();
  await page.getByRole("button", { name: /^Check/u }).click();
  await page.getByRole("button", { name: /^Continue/u }).click();
  await bank().getByRole("button", { exact: true, name: "many" }).click();
  await page.getByRole("button", { name: /^Check/u }).click();

  await expect
    .element(page.getByText("Not quite. Look again and fix it yourself, then check."))
    .toBeVisible();

  await page.getByRole("button", { name: /^Check/u }).click();
  await expect.element(noThanks()).toBeVisible();
}

async function crossTo(size: { height: number; width: number }) {
  await page.viewport(size.width, size.height);
  await feedbackFollowsBank(size === LAPTOP);
}

describe("a word bank's feedback across lg", () => {
  it("keeps the control the learner was on, and an offer they dismissed, when the screen crosses lg both ways", async () => {
    await atViewport(PHONE, async () => {
      await missTwiceOnTheBank();
      await feedbackFollowsBank(false);

      const ask = offerAsk();
      expect(ask).not.toBeNull();
      ask?.focus();
      expect(document.activeElement).toBe(ask);

      await crossTo(LAPTOP);
      expect(document.activeElement).toBe(ask);

      await crossTo(PHONE);
      expect(document.activeElement).toBe(ask);

      await noThanks().click();
      await expect.element(noThanks()).not.toBeInTheDocument();

      await crossTo(LAPTOP);
      await expect.element(noThanks()).not.toBeInTheDocument();

      await crossTo(PHONE);
      await expect.element(noThanks()).not.toBeInTheDocument();
    });
  });
});
