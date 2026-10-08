import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { press } from "../_test-utils/activity-player";
import { languageStep, pairWord } from "../_test-utils/language-steps";
import { explanationStep, teachingStep } from "../_test-utils/lesson-steps";
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
  it("shows the lesson's minutes and keeps its summary card in the screen's menu", async () => {
    renderLessonPlayer({
      lesson: buildLesson([teachingStep("explanation"), teachingStep("check")], {
        estimatedMinutes: 4,
        summaryIdeas: ["Electrons live in clouds.", "The densest part is likeliest."],
      }),
    });

    await expect.element(page.getByText(EXPLANATION_TITLE)).toBeVisible();

    // The header has the lesson's title and minutes.
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

  it("shows a written answer nothing checked next to the sample answer, without calling it wrong", async () => {
    const lesson = buildLesson([teachingStep("typedAnswer"), teachingStep("summary")]);

    // Past a few graded answers to the screen today, the server didn't check a paraphrase.
    const checkStep = vi.fn<LessonPlayerAdapters["checkStep"]>(() =>
      Promise.resolve({
        result: {
          checked: false,
          correctAnswer: "Because it maps chances.",
          corrections: [],
          feedback: null,
          isCorrect: false,
          keyPoints: null,
          nextReviewAt: null,
          savedMistake: false,
          score: null,
          spelling: null,
        },
        status: "checked" as const,
      }),
    );

    renderLessonPlayer({ adapters: buildAdapters(lesson, { checkStep }), lesson });

    await page
      .getByRole("textbox", { name: "In your own words: why is the electron drawn as a cloud?" })
      .fill("It's where it probably is");

    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(verdict("Not checked this time")).toBeVisible();

    await expect
      .element(page.getByRole("status").getByText("Because it maps chances."))
      .toBeVisible();

    await expect.element(verdict("Not quite")).not.toBeInTheDocument();

    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect.element(page.getByRole("heading", { name: "Summary" })).toBeVisible();
  });

  it("counts a typo as right and shows the spelling", async () => {
    const lesson = buildLesson([teachingStep("typedAnswer"), teachingStep("summary")]);

    // The server grades written answers; this is its verdict on a typo of an accepted answer.
    const checkStep = vi.fn<LessonPlayerAdapters["checkStep"]>(() =>
      Promise.resolve({
        result: {
          checked: true,
          correctAnswer: null,
          corrections: [],
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

    renderLessonPlayer({ adapters: buildAdapters(lesson, { checkStep }), lesson });

    await page
      .getByRole("textbox", { name: "In your own words: why is the electron drawn as a cloud?" })
      .fill("It shows where the electorn is likely to be");

    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(verdict("Right, watch the spelling")).toBeVisible();
    await expect.element(page.getByRole("status").getByText(RIGHT_TYPED)).toBeVisible();

    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect.element(page.getByRole("heading", { name: "Summary" })).toBeVisible();
  });

  it("names a language answer's form mistake without calling a stated idea missing", async () => {
    const lesson = buildLesson([teachingStep("typedAnswer"), teachingStep("summary")]);
    const answer = "It show where the electron is likely to be";

    // The server's verdict on a language answer that states every idea with one form mistake.
    const checkStep = vi.fn<LessonPlayerAdapters["checkStep"]>(() =>
      Promise.resolve({
        result: {
          checked: true,
          correctAnswer: RIGHT_TYPED,
          corrections: [{ right: "It shows", wrong: "It show" }],
          feedback: "Every idea is there; with “it” the verb is “shows”.",
          isCorrect: false,
          keyPoints: [
            { met: true, text: "We can't know the electron's exact position or path" },
            { met: true, text: "The cloud shows where it's likely to be found" },
          ],
          nextReviewAt: null,
          savedMistake: true,
          score: 1,
          spelling: null,
        },
        status: "checked" as const,
      }),
    );

    renderLessonPlayer({ adapters: buildAdapters(lesson, { checkStep }), lesson });

    await page
      .getByRole("textbox", { name: "In your own words: why is the electron drawn as a cloud?" })
      .fill(answer);

    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(verdict("Almost there")).toBeVisible();

    await expect
      .element(page.getByRole("status").getByRole("listitem").first())
      .toHaveTextContent("Your answer: It show Correct answer: It shows");

    await expect.element(page.getByText("2 of 2 key points")).toBeVisible();
    await expect.element(page.getByText("Missing:")).not.toBeInTheDocument();
  });

  it("teaches a word with its note and tip, then checks it", async () => {
    renderLessonPlayer({
      lesson: buildLesson(
        [languageStep("vocabulary"), languageStep("translation"), languageStep("reading")],
        { language: "pt", targetLanguage: "en" },
      ),
    });

    await expect.element(page.getByRole("region", { name: "Vocabulary: rent" })).toBeVisible();
    await expect.element(page.getByText("aluguel", { exact: true })).toBeVisible();
    await expect.element(page.getByText("Não confunda com renda, que é income.")).toBeVisible();
    // Writers mark the word's letters as code and quotes in italics: shown formatted, never raw.
    await expect.element(page.getByText("O r do começo é suave, não como em rato.")).toBeVisible();
    await expect.element(page.getByText("r", { exact: true })).toHaveProperty("tagName", "CODE");
    await page.getByRole("button", { name: /^Next/u }).click();

    await expect.element(page.getByText("Translate:", { exact: true })).toBeVisible();
    await page.getByRole("radio", { name: "Rent" }).click();
    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(verdict("Correct!")).toBeVisible();
    await expect.element(page.getByText("Não confunda com renda, que é income.")).toBeVisible();
    await page.getByRole("button", { name: /^Continue/u }).click();

    await expect.element(page.getByRole("group", { name: "Word bank" })).toBeVisible();
  });

  it("asks to translate a noun with its article without calling it a phrase", async () => {
    // Words carry their article ("as colunas", "die Miete") and chunks are several words
    // ("Thanks for having me"): the prompt names neither, so it fits both.
    const columns = pairWord({ translation: "as colunas", word: "columns" });

    renderLessonPlayer({
      lesson: buildLesson([languageStep("translation", {}, { word: columns })], {
        language: "pt",
        targetLanguage: "en",
      }),
    });

    await expect.element(page.getByText("Translate:", { exact: true })).toBeVisible();
    await expect.element(page.getByText("as colunas", { exact: true })).toBeVisible();
    await expect.element(page.getByText(/phrase/iu)).not.toBeInTheDocument();
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

  it("shows each screen's own personal example, and nothing where the learner has none", async () => {
    const discount = explanationStep({
      exampleLineSlot: { idea: "A discount on something the learner buys." },
      text: "A 25% discount takes a quarter off the price.",
      title: "Discounts",
    });

    const interest = explanationStep({
      exampleLineSlot: { idea: "Interest on an installment plan the learner pays." },
      text: "Paying in installments with interest costs more than paying the price at once.",
      title: "Interest",
    });

    const markup = explanationStep({
      exampleLineSlot: { idea: "A price the learner sets at work." },
      text: "A markup adds a percent of the cost to set the price.",
      title: "Markups",
    });

    const lesson = buildLesson([discount, interest, markup]);

    const lines: Record<string, string> = {
      [discount.id]: "At the pharmacy where you work, 25% off a $40 kit saves $10.",
      [interest.id]: "Your scooter's 12 payments of $110 for $1,200 add $120 of interest.",
    };

    // The server writes a lesson's lines together, each a different moment, or none.
    const getExampleLine = vi.fn<NonNullable<LessonPlayerAdapters["getExampleLine"]>>(
      ({ stepId }) => Promise.resolve(lines[stepId] ?? null),
    );

    renderLessonPlayer({ adapters: buildAdapters(lesson, { getExampleLine }), lesson });

    const example = page.getByRole("complementary", { name: "Your example" });

    await expect.element(example).toHaveTextContent(lines[discount.id] ?? "");
    await page.getByRole("button", { name: /^Next/u }).click();

    await expect.element(page.getByText("Interest", { exact: true })).toBeVisible();
    await expect.element(example).toHaveTextContent(lines[interest.id] ?? "");
    await page.getByRole("button", { name: /^Next/u }).click();

    await expect.element(page.getByText("Markups", { exact: true })).toBeVisible();
    await vi.waitFor(() => expect(getExampleLine).toHaveBeenCalledWith({ stepId: markup.id }));
    await expect.element(example).not.toBeInTheDocument();
  });
});
