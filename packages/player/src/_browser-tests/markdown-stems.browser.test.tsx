import { collectMathMarkup } from "@zoonk/learn/rich-text/math";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { atViewport } from "../_test-utils/browser-viewport";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { teachingStep } from "../preview/preview-steps";

function check(question: string) {
  const step = teachingStep("check");
  return { ...step, content: { ...step.content, question } };
}

describe("Markdown question stems", () => {
  it("reads structured stems on a phone and answers them through lesson completion", async () => {
    await atViewport({ height: 844, width: 390 }, async () => {
      const lesson = buildLesson([
        check(
          "Choose the accurate description.\n\n- A cloud describes probability.\n- A path describes a fixed route.",
        ),
        check(String.raw`Compare the readings:

| Sensor | Formula | Readings |
| --- | --- | ---: |
| **A** | \(x^2\) | 350000 |
| B | $y^2$ | 12 |

Which sensor has more readings?`),
      ]);

      renderLessonPlayer({ lesson });

      await expect
        .element(page.getByRole("heading", { name: "Choose the accurate description." }))
        .toBeVisible();

      await expect
        .element(page.getByRole("listitem").filter({ hasText: "A cloud describes probability." }))
        .toBeVisible();

      await page
        .getByRole("radio", { name: "Where the electron is most likely to be found" })
        .click();

      await page.getByRole("button", { name: /^Check/u }).click();
      await page.getByRole("button", { name: /^Continue/u }).click();

      const table = page.getByRole("table");
      await expect.element(table.getByRole("columnheader", { name: "Formula" })).toBeVisible();
      await expect.element(table.getByRole("cell", { name: "350,000" })).toBeVisible();
      expect(table.element().querySelectorAll("math")).toHaveLength(2);
      expect(document.querySelector("h2 table, p table")).toBeNull();

      await expect
        .element(page.getByRole("heading", { name: "Which sensor has more readings?" }))
        .toBeVisible();

      await page
        .getByRole("radio", { name: "Where the electron is most likely to be found" })
        .click();

      await page.getByRole("button", { name: /^Check/u }).click();
      await page.getByRole("button", { name: /^Continue/u }).click();
      await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
    });
  });

  it("draws a lesson's formulas as its server drew them, on every screen", async () => {
    const drawn = '<math data-drawn="server"><mi>v</mi></math>';

    const lesson = buildLesson([
      check("Which choice fits the orbit?"),
      check(String.raw`At what speed \(v\) does it stay up?`),
    ]);

    // The server's drawing, marked so the screen shows it wasn't drawn again in the browser.
    const keys = Object.keys(collectMathMarkup(lesson));
    renderLessonPlayer({ lesson, mathMarkup: Object.fromEntries(keys.map((key) => [key, drawn])) });

    await page
      .getByRole("radio", { name: "Where the electron is most likely to be found" })
      .click();

    await page.getByRole("button", { name: /^Check/u }).click();
    await page.getByRole("button", { name: /^Continue/u }).click();

    await expect.element(page.getByRole("heading", { name: /At what speed/u })).toBeVisible();
    expect(document.querySelectorAll('math[data-drawn="server"]')).toHaveLength(1);
  });
});
