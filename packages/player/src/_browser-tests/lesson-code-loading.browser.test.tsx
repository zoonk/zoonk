import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { teachingStep } from "../preview/preview-steps";

const RARE_CODE = {
  katex: /\/math-markup\.ts|deps\/katex\.js/u,
  markdown: /\/tutor-markdown\.tsx|streamdown/u,
};

function loaded(pattern: RegExp): boolean {
  return performance.getEntriesByType("resource").some((entry) => pattern.test(entry.name));
}

function check(question: string) {
  const step = teachingStep("check");
  return { ...step, content: { ...step.content, question } };
}

async function answerAndContinue() {
  await page.getByRole("radio", { name: "Where the electron is most likely to be found" }).click();
  await page.getByRole("button", { name: /^Check/u }).click();
  await page.getByRole("button", { name: /^Continue/u }).click();
}

describe("a lesson's code", () => {
  it("plays a lesson without math or tutor answers without loading their code", async () => {
    renderLessonPlayer({ lesson: buildLesson([check("Which cloud fits?"), check("And now?")]) });

    await answerAndContinue();
    await expect.element(page.getByRole("heading", { name: "And now?" })).toBeVisible();
    await answerAndContinue();
    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

    expect(loaded(/\/lesson-step-view\.tsx/u)).toBe(true);
    expect(loaded(RARE_CODE.katex)).toBe(false);
    expect(loaded(RARE_CODE.markdown)).toBe(false);
  });

  it("loads a later screen's math while the first screen is read", async () => {
    renderLessonPlayer({
      lesson: buildLesson([
        check("Which cloud fits?"),
        check(String.raw`At what speed \(v\) does it stay up?`),
      ]),
    });

    await expect.element(page.getByRole("heading", { name: "Which cloud fits?" })).toBeVisible();
    await expect.poll(() => loaded(RARE_CODE.katex)).toBe(true);

    await answerAndContinue();
    await expect.element(page.getByRole("heading", { name: /At what speed/u })).toBeVisible();
    expect(document.querySelectorAll("math")).toHaveLength(1);
  });
});
