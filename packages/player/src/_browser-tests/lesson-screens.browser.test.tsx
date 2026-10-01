import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { press } from "../_test-utils/activity-player";
import { languageStep } from "../_test-utils/language-steps";
import { teachingStep } from "../_test-utils/lesson-steps";
import {
  buildAdapters,
  buildLesson,
  renderLessonPlayer,
} from "../_test-utils/render-lesson-player";
import { type LessonPlayerAdapters } from "../lesson/lesson-player-types";

/**
 * What a lesson shows around its screens: the header's minutes and the summary card in the
 * screen's menu, the right spelling of a typo, a word's note and sound tip, and the dated Sources
 * chip of a screen built from a public document.
 */

const EXPLANATION_TITLE = "A cloud, not a little ball";
const RIGHT_TYPED = "It shows where the electron is likely to be";

/** A verdict as the player announces it. */
function verdict(text: string) {
  return page.getByRole("status").filter({ hasText: text });
}

describe("lesson screens", () => {
  it("shows the lesson's minutes in Focus and keeps its summary card in the screen's menu", async () => {
    renderLessonPlayer({
      lesson: buildLesson([teachingStep("explanation"), teachingStep("check")], {
        estimatedMinutes: 4,
        summaryIdeas: ["Electrons live in clouds.", "The densest part is likeliest."],
      }),
    });

    await expect.element(page.getByText(EXPLANATION_TITLE)).toBeVisible();

    // Focus's header has the title and minutes; Fun's has the dots instead.
    await expect.element(page.getByText("4 min", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Screen options" }).click();
    await page.getByRole("menuitem", { name: "Lesson summary" }).click();

    const summary = page.getByRole("dialog", { name: "Lesson summary" });
    await expect.element(summary.getByText("Electrons live in clouds.")).toBeVisible();
    await expect.element(summary.getByText("The densest part is likeliest.")).toBeVisible();

    await summary.getByRole("button", { name: "Got it" }).click();
    await expect.element(summary).not.toBeInTheDocument();
    await expect.element(page.getByText(EXPLANATION_TITLE)).toBeVisible();
  });

  it("counts a typo as right and shows the spelling", async () => {
    const lesson = buildLesson([teachingStep("typedAnswer"), teachingStep("summary")]);

    // The server grades written answers; this is its verdict on a typo of an accepted answer.
    const checkStep = vi.fn<LessonPlayerAdapters["checkStep"]>(() =>
      Promise.resolve({
        result: {
          correctAnswer: null,
          feedback: null,
          isCorrect: true,
          keyPoints: null,
          nextReviewAt: null,
          savedMistake: false,
          score: 1,
          spelling: RIGHT_TYPED,
        },
        status: "checked" as const,
      }),
    );

    renderLessonPlayer({ adapters: buildAdapters(lesson, { checkStep }), lesson, mode: "fun" });

    await page
      .getByRole("textbox", { name: "In your own words: why is the electron drawn as a cloud?" })
      .fill("It shows where the electorn is likely to be");

    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(verdict("Right, watch the spelling")).toBeVisible();
    await expect.element(page.getByRole("status").getByText(RIGHT_TYPED)).toBeVisible();

    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect.element(page.getByRole("heading", { name: "Summary" })).toBeVisible();
  });

  it("teaches a word with its note and tip, then checks it", async () => {
    renderLessonPlayer({
      lesson: buildLesson(
        [languageStep("vocabulary"), languageStep("translation"), languageStep("reading")],
        { language: "pt", targetLanguage: "en" },
      ),
      mode: "fun",
    });

    await expect.element(page.getByRole("region", { name: "Vocabulary: rent" })).toBeVisible();
    await expect.element(page.getByText("aluguel", { exact: true })).toBeVisible();
    await expect.element(page.getByText("Não confunda com renda, que é income.")).toBeVisible();
    await expect.element(page.getByText("O r do começo é suave, não como em rato.")).toBeVisible();
    await page.getByRole("button", { name: /^Next/u }).click();

    await expect.element(page.getByText("Translate this word:")).toBeVisible();
    await page.getByRole("radio", { name: "Rent" }).click();
    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(verdict("Correct!")).toBeVisible();
    await expect.element(page.getByText("Não confunda com renda, que é income.")).toBeVisible();
    await page.getByRole("button", { name: /^Continue/u }).click();

    await expect.element(page.getByRole("group", { name: "Word bank" })).toBeVisible();
  });

  it("dates a screen built from a law and opens the law from its Sources chip", async () => {
    const fromLaw = {
      ...teachingStep("explanation"),
      citation: {
        checkedAt: new Date("2026-09-12T10:00:00.000Z"),
        kind: "source" as const,
        publisher: "Planalto",
        title: "Law 8,112",
        url: "https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm",
      },
    };

    renderLessonPlayer({ lesson: buildLesson([fromLaw, teachingStep("check")]) });

    await expect.element(page.getByText(EXPLANATION_TITLE)).toBeVisible();
    await page.getByRole("button", { name: "Sources · Checked Sep 2026" }).click();

    const source = page.getByRole("dialog");
    await expect.element(source.getByRole("heading", { name: "Law 8,112" })).toBeVisible();
    await expect.element(source.getByText("Planalto · Checked Sep 12, 2026")).toBeVisible();

    await expect
      .element(source.getByRole("link", { name: "Open the source" }))
      .toHaveAttribute("href", fromLaw.citation.url);

    // Closing it leaves the lesson where it was.
    await press("Escape");
    await expect.element(source).not.toBeInTheDocument();
    await expect.element(page.getByText(EXPLANATION_TITLE)).toBeVisible();
  });
});
