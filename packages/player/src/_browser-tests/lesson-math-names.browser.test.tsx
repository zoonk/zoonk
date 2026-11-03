import { collectMathMarkup } from "@zoonk/learn/rich-text/math";
import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { MODULE_LOAD_TIMEOUT_MS } from "../_test-utils/module-load";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { contentStep, explanationStep } from "../preview/preview-steps";

const POWERS_OF_TEN_HOOK = {
  options: [
    { id: "a", isCorrect: false, text: "$10^{-8}$" },
    { id: "b", isCorrect: false, text: "$10^6$" },
    { id: "c", isCorrect: true, text: "$10^2$" },
  ],
  question: "A lab display multiplies $10^4$ by $10^{-2}$. What should it show?",
  reveal: "It should show $10^2$. The next screen shows why.",
  variant: "guess",
};

function radio(name: string) {
  return page.getByRole("radio", { exact: true, name });
}

describe("lesson math in accessible names", () => {
  it("names a question and its math-only options in words", async () => {
    const lesson = buildLesson([contentStep("hook", { content: POWERS_OF_TEN_HOOK })]);
    renderLessonPlayer({ lesson, mathMarkup: collectMathMarkup(lesson) });

    await expect
      .element(
        page.getByRole("heading", {
          level: 2,
          name: "A lab display multiplies 10 to the power of 4 by 10 to the power of −2",
        }),
      )
      .toBeVisible();

    await expect.element(radio("10 to the power of −8")).toBeVisible();
    await expect.element(radio("10 to the power of 6")).toBeVisible();
    await expect.element(radio("10 squared")).toBeVisible();
    expect(document.querySelectorAll("[data-slot='answer-option'] math")).toHaveLength(3);

    await radio("10 to the power of −8").click();
    await page.getByRole("button", { name: /^See the answer/u }).click();

    await expect.element(radio("10 to the power of −8 Your guess")).toBeChecked();
    await expect.element(radio("10 squared Correct")).toBeVisible();
  });

  it("names an explanation's title, table headers and explored model in words", async () => {
    const { data, fields } = activityContentFixtures.formulaModel;

    const lesson = buildLesson([
      explanationStep({
        explore: { data, fields, template: "formulaModel" },
        text: String.raw`When you multiply powers of ten, add their exponents: $10^a \times 10^b=10^{a+b}$.

| $a$ | $10^a$ |
| --- | --- |
| 2 | 100 |`,
        title: "Multiply $10^a$ by $10^b$",
      }),
    ]);

    renderLessonPlayer({ lesson, mathMarkup: collectMathMarkup(lesson) });

    await expect
      .element(
        page.getByRole("heading", {
          exact: true,
          level: 2,
          name: "Multiply 10 to the power of a by 10 to the power of b",
        }),
      )
      .toBeVisible();

    await expect
      .element(page.getByRole("columnheader", { exact: true, name: "10 to the power of a" }))
      .toBeVisible();

    await expect
      .element(
        page.getByRole("figure", {
          name: "add their exponents: 10 to the power of a × 10 to the power of b = 10 to the power of a+b",
        }),
        { timeout: MODULE_LOAD_TIMEOUT_MS },
      )
      .toBeVisible();
  });
});
