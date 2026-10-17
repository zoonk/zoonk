import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { press } from "../_test-utils/activity-player";
import { atViewport } from "../_test-utils/browser-viewport";
import { onDevice } from "../_test-utils/device-media";
import { buildAdapters, renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { type ExampleLine, type LessonPlayerAdapters } from "../lesson/lesson-player-types";
import { buildLesson } from "../preview/preview-lesson";
import { explanationStep, languageStep, teachingStep } from "../preview/preview-steps";

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
  it("keeps the header to one row and its summary card in the screen's menu", async () => {
    renderLessonPlayer({
      lesson: buildLesson([teachingStep("explanation"), teachingStep("check")], {
        estimatedMinutes: 4,
        summaryIdeas: ["Electrons live in clouds.", "The densest part is likeliest."],
      }),
    });

    await expect.element(page.getByText(EXPLANATION_TITLE)).toBeVisible();

    // The header is one row: close, the lesson's title and the menu, without its minutes.
    await expect.element(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect.element(page.getByText("4 min", { exact: true })).not.toBeInTheDocument();

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

    // The mistake as a diff: what they wrote, then its right form.
    const corrections = page.getByRole("status").getByRole("listitem");
    await expect.element(corrections.nth(0)).toMatchTextContent("Your answer: It show");
    await expect.element(corrections.nth(1)).toMatchTextContent("Correct answer: It shows");

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

    await expect.element(page.getByText("Translate", { exact: true })).toBeVisible();
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
    const columns = { translation: "as colunas", word: "columns" };

    renderLessonPlayer({
      lesson: buildLesson([languageStep("translation", {}, { word: columns })], {
        language: "pt",
        targetLanguage: "en",
      }),
    });

    await expect.element(page.getByText("Translate", { exact: true })).toBeVisible();
    await expect.element(page.getByText("as colunas", { exact: true })).toBeVisible();
    await expect.element(page.getByText(/phrase/iu)).not.toBeInTheDocument();
  });

  it("asks which one a definition means when the lesson is in the learner's own language", async () => {
    // An IELTS candidate reading the app in English learns English words from definitions.
    const rent = { translation: "money you pay each month to live somewhere", word: "rent" };

    renderLessonPlayer({
      lesson: buildLesson([languageStep("translation", {}, { word: rent })], {
        language: "en",
        targetLanguage: "en",
      }),
    });

    await expect.element(page.getByText("Which one means this?", { exact: true })).toBeVisible();
    await expect.element(page.getByText(rent.translation, { exact: true })).toBeVisible();
    await expect.element(page.getByText("Translate", { exact: true })).not.toBeInTheDocument();
    await page.getByRole("radio", { name: "Rent" }).click();
    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(verdict("Correct!")).toBeVisible();
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
      ({ stepId }) => Promise.resolve({ canRequest: false, line: lines[stepId] ?? null }),
    );

    renderLessonPlayer({
      adapters: buildAdapters(lesson, { getExampleLine, requestExampleLine: vi.fn() }),
      lesson,
    });

    const example = page.getByRole("complementary", { name: "Your example" });

    await expect.element(example).toHaveTextContent(lines[discount.id] ?? "");
    await page.getByRole("button", { name: /^Next/u }).click();

    await expect.element(page.getByText("Interest", { exact: true })).toBeVisible();
    await expect.element(example).toHaveTextContent(lines[interest.id] ?? "");
    await page.getByRole("button", { name: /^Next/u }).click();

    // Written as none: nothing shows, and there's nothing to ask for.
    await expect.element(page.getByText("Markups", { exact: true })).toBeVisible();
    await vi.waitFor(() => expect(getExampleLine).toHaveBeenCalledWith({ stepId: markup.id }));
    await expect.element(example).not.toBeInTheDocument();

    await expect
      .element(page.getByRole("button", { name: "Show an example from my life" }))
      .not.toBeInTheDocument();
  });

  it("offers no example to a learner who shares nothing it could be written from", async () => {
    const step = explanationStep({
      exampleLineSlot: { idea: "A discount." },
      text: "A discount lowers the price.",
    });

    const lesson = buildLesson([step]);

    const getExampleLine = vi.fn<NonNullable<LessonPlayerAdapters["getExampleLine"]>>(() =>
      Promise.resolve({ canRequest: false, line: null }),
    );

    const requestExampleLine = vi.fn<NonNullable<LessonPlayerAdapters["requestExampleLine"]>>();

    renderLessonPlayer({
      adapters: buildAdapters(lesson, { getExampleLine, requestExampleLine }),
      lesson,
    });

    await vi.waitFor(() => expect(getExampleLine).toHaveBeenCalledWith({ stepId: step.id }));
    await expect.element(page.getByText("A discount lowers the price.")).toBeVisible();

    await expect
      .element(page.getByRole("button", { name: "Show an example from my life" }))
      .not.toBeInTheDocument();

    expect(requestExampleLine).not.toHaveBeenCalled();
  });

  it.each(
    [390, 820, 1180, 1440].flatMap((width) => [
      { colorScheme: "light" as const, width },
      { colorScheme: "dark" as const, width },
    ]),
  )(
    "reads on entry and writes only on request at $width in $colorScheme",
    async ({ colorScheme, width }) => {
      await atViewport({ height: 900, width }, () =>
        onDevice({ colorScheme }, async () => {
          const discount = explanationStep({
            exampleLineSlot: { idea: "A discount." },
            text: "A discount lowers the price.",
            title: "Discounts",
          });

          const interest = explanationStep({
            exampleLineSlot: { idea: "An installment payment." },
            text: "Interest adds to the price.",
            title: "Interest",
          });

          const lesson = buildLesson([discount, interest]);

          const getExampleLine = vi.fn<NonNullable<LessonPlayerAdapters["getExampleLine"]>>(() =>
            Promise.resolve({ canRequest: true, line: null }),
          );

          const requestExampleLine = vi.fn<NonNullable<LessonPlayerAdapters["requestExampleLine"]>>(
            () =>
              Promise.resolve({
                canRequest: false,
                line: "Your R$ 40 kit costs R$ 30 after a 25% discount.",
              }),
          );

          renderLessonPlayer({
            adapters: buildAdapters(lesson, { getExampleLine, requestExampleLine }),
            lesson,
          });

          const offer = page.getByRole("button", { name: "Show an example from my life" });

          await expect.element(offer).toBeVisible();
          expect(getExampleLine).toHaveBeenCalledWith({ stepId: discount.id });
          expect(requestExampleLine).not.toHaveBeenCalled();
          await offer.click();

          await expect
            .element(page.getByRole("complementary", { name: "Your example" }))
            .toHaveTextContent("Your R$40 kit costs R$30 after a 25% discount.");

          expect(requestExampleLine).toHaveBeenCalledExactlyOnceWith({ stepId: discount.id });

          await page.getByRole("button", { name: /^Next/u }).click();
          await expect.element(page.getByText("Interest", { exact: true })).toBeVisible();
          await expect.element(offer).toBeVisible();

          await expect
            .element(page.getByRole("complementary", { name: "Your example" }))
            .not.toBeInTheDocument();

          expect(getExampleLine).toHaveBeenCalledWith({ stepId: interest.id });
          expect(requestExampleLine).toHaveBeenCalledOnce();
          await page.getByRole("button", { name: /^Continue/u }).click();
        }),
      );
    },
  );

  it("says so when nothing the learner shared fits, without offering it again", async () => {
    const step = explanationStep({
      exampleLineSlot: { idea: "A discount." },
      text: "A discount lowers the price.",
    });

    const lesson = buildLesson([step]);

    const requestExampleLine = vi.fn<NonNullable<LessonPlayerAdapters["requestExampleLine"]>>(() =>
      Promise.resolve({ canRequest: false, line: null }),
    );

    renderLessonPlayer({
      adapters: buildAdapters(lesson, {
        getExampleLine: () => Promise.resolve({ canRequest: true, line: null }),
        requestExampleLine,
      }),
      lesson,
    });

    await page.getByRole("button", { name: "Show an example from my life" }).click();

    await expect
      .element(page.getByRole("status"))
      .toHaveTextContent("Nothing you've shared fits this idea.");

    await expect
      .element(page.getByRole("button", { name: "Show an example from my life" }))
      .not.toBeInTheDocument();

    await page.getByRole("button", { name: /^Continue/u }).click();
    expect(requestExampleLine).toHaveBeenCalledOnce();
  });

  it("keeps the offer when a request doesn't go through, so the learner can ask again", async () => {
    const step = explanationStep({
      exampleLineSlot: { idea: "A discount." },
      text: "A discount lowers the price.",
    });

    const lesson = buildLesson([step]);

    const requestExampleLine = vi.fn<NonNullable<LessonPlayerAdapters["requestExampleLine"]>>(() =>
      Promise.resolve(null),
    );

    renderLessonPlayer({
      adapters: buildAdapters(lesson, {
        getExampleLine: () => Promise.resolve({ canRequest: true, line: null }),
        requestExampleLine,
      }),
      lesson,
    });

    await page.getByRole("button", { name: "Show an example from my life" }).click();

    await expect
      .element(page.getByRole("status"))
      .toHaveTextContent("No example is available right now.");

    await expect
      .element(page.getByRole("button", { name: "Show an example from my life" }))
      .toBeEnabled();

    expect(requestExampleLine).toHaveBeenCalledOnce();
  });

  it("keeps navigation available while an example request is pending", async () => {
    const first = explanationStep({
      exampleLineSlot: { idea: "A discount." },
      text: "A discount lowers the price.",
    });

    const second = explanationStep({
      exampleLineSlot: { idea: "Interest." },
      text: "Interest adds to the price.",
    });

    const lesson = buildLesson([first, second]);
    const pending = Promise.withResolvers<ExampleLine | null>();

    const requestExampleLine = vi.fn<NonNullable<LessonPlayerAdapters["requestExampleLine"]>>(
      () => pending.promise,
    );

    renderLessonPlayer({
      adapters: buildAdapters(lesson, {
        getExampleLine: () => Promise.resolve({ canRequest: true, line: null }),
        requestExampleLine,
      }),
      lesson,
    });

    await page.getByRole("button", { name: "Show an example from my life" }).click();

    await expect
      .element(page.getByRole("button", { name: "Writing your example…" }))
      .toBeDisabled();

    await page.getByRole("button", { name: /^Next/u }).click();
    await expect.element(page.getByText("Interest adds to the price.")).toBeVisible();
    pending.resolve({ canRequest: false, line: "The first screen's delayed example." });

    await expect
      .element(page.getByRole("button", { name: "Show an example from my life" }))
      .toBeVisible();

    await expect
      .element(page.getByText("The first screen's delayed example."))
      .not.toBeInTheDocument();

    await page.getByRole("button", { name: /^Continue/u }).click();
    expect(requestExampleLine).toHaveBeenCalledExactlyOnceWith({ stepId: first.id });
  });

  it("lists a short story's screens beside them on a wide screen, the one in view marked", async () => {
    const lesson = buildLesson([
      explanationStep({ text: "Water molecules spin.", title: "Molecules that spin" }),
      explanationStep({ text: "Spinning makes heat.", title: "From spin to heat" }),
      teachingStep("check"),
    ]);

    // A quick explanation asks for its outline; other lessons keep the aside for the buddy.
    renderLessonPlayer({ lesson, outline: true });

    const outline = page
      .getByRole("complementary", { name: "Help with this screen" })
      .getByRole("list", { name: "Outline" });

    const row = (title: string) => outline.getByRole("listitem").filter({ hasText: title });

    await expect.element(row("Molecules that spin")).toHaveAttribute("aria-current", "step");
    await expect.element(outline.getByText("1 quick question at the end")).toBeVisible();

    await page.getByRole("button", { name: /^Next/u }).click();
    await expect.element(row("From spin to heat")).toHaveAttribute("aria-current", "step");
    await expect.element(row("Molecules that spin")).not.toHaveAttribute("aria-current");
    await expect.element(row("Molecules that spin").getByText(", read")).toBeInTheDocument();

    // The question at the end shows the last screen it's about instead.
    await page.getByRole("button", { name: /^Next/u }).click();
    await expect.element(outline).not.toBeInTheDocument();
    await expect.element(page.getByText("From the lesson")).toBeVisible();
  });
});
