import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { atViewport } from "../_test-utils/browser-viewport";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { languageStep } from "../preview/preview-steps";

const PHONE = { height: 844, width: 390 };

const bank = () => page.getByRole("group", { name: "Word bank" });
const check = () => page.getByRole("button", { name: /^Check/u });

function bankTop(): number {
  return bank().element().getBoundingClientRect().top;
}

/** The answer grows into the room between it and the bank, so that room is above the bank, not under it. */
function roomUnderBank(): number {
  return (
    check().element().getBoundingClientRect().top - bank().element().getBoundingClientRect().bottom
  );
}

function roomAboveBank(): number {
  const answer = page.getByRole("group", { name: "Your answer" }).element();
  return bankTop() - answer.getBoundingClientRect().bottom;
}

describe("a word bank on a phone", () => {
  it("waits at the bottom, above Check, and holds still as words go into the answer", async () => {
    await atViewport(PHONE, async () => {
      renderLessonPlayer({
        lesson: buildLesson([languageStep("reading")], { language: "pt", targetLanguage: "en" }),
      });

      await expect.element(bank()).toBeVisible();
      expect(roomAboveBank()).toBeGreaterThan(roomUnderBank());

      const top = bankTop();

      for (const word of ["How", "much", "is", "the", "rent?", "many", "are"]) {
        // oxlint-disable-next-line no-await-in-loop -- The words go in one at a time, in order.
        await bank().getByRole("button", { exact: true, name: word }).click();
        expect(bankTop()).toBe(top);
      }

      await check().click();

      await expect
        .element(page.getByText("Not quite. Look again and fix it yourself, then check."))
        .toBeVisible();

      expect(bankTop()).toBe(top);

      await page.getByRole("button", { name: "Position 7: are. Tap to remove." }).click();
      await page.getByRole("button", { name: "Position 6: many. Tap to remove." }).click();
      expect(bankTop()).toBe(top);

      await check().click();
      await expect.element(page.getByRole("region", { name: "Answer feedback" })).toBeVisible();
      expect(bankTop()).toBe(top);
    });
  });
});
