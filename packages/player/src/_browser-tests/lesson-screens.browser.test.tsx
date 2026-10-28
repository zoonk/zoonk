import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { press } from "../_test-utils/activity-player";
import { atViewport } from "../_test-utils/browser-viewport";
import {
  buildAdapters,
  renderLessonPlayer,
  runAnswer,
  startedRun,
} from "../_test-utils/render-lesson-player";
import { type ExampleLine, type LessonPlayerAdapters } from "../lesson/lesson-player-types";
import { buildLesson } from "../preview/preview-lesson";
import { explanationStep, languageStep, teachingStep } from "../preview/preview-steps";

const EXPLANATION_TITLE = "A cloud, not a little ball";
const PHONE = { height: 844, width: 390 };
const RIGHT_OPTION = "Where the electron is most likely to be found";
const RIGHT_TYPED = "It shows where the electron is likely to be";

function verdict(text: string) {
  return page.getByRole("status").filter({ hasText: text });
}

async function answerRight() {
  await page.getByRole("radio", { name: RIGHT_OPTION }).click();
  await page.getByRole("button", { name: /^Check/u }).click();
  await page.getByRole("button", { name: /^Continue/u }).click();
}

describe("lesson screens", () => {
  it("keeps the summary card in the screen's menu for the lesson's end", async () => {
    await atViewport(PHONE, async () => {
      renderLessonPlayer({
        lesson: buildLesson([teachingStep("explanation"), teachingStep("check")], {
          summaryIdeas: ["Electrons live in clouds.", "The densest part is likeliest."],
        }),
      });

      await expect.element(page.getByText(EXPLANATION_TITLE)).toBeVisible();

      const knowThis = page.getByRole("menuitem", { name: "I already know this" });
      const summaryItem = page.getByRole("menuitem", { name: "Lesson summary" });
      await page.getByRole("button", { name: "Screen options" }).click();
      await expect.element(knowThis).toBeVisible();
      await expect.element(summaryItem).not.toBeInTheDocument();
      await press("Escape");

      await page.getByRole("button", { name: /^Next/u }).click();
      await page.getByRole("radio", { name: RIGHT_OPTION }).click();
      await page.getByRole("button", { name: /^Check/u }).click();
      await page.getByRole("button", { name: /^Continue/u }).click();
      await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

      await page.getByRole("button", { name: "Screen options" }).click();
      await summaryItem.click();

      const summary = page.getByRole("dialog", { name: "Lesson summary" });
      await expect.element(summary.getByText("Electrons live in clouds.")).toBeVisible();
      await expect.element(summary.getByText("The densest part is likeliest.")).toBeVisible();

      await summary.getByRole("button", { name: "Got it" }).click();
      await expect.element(summary).not.toBeInTheDocument();
      await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
    });
  });

  it("keeps the summary card in the menu of a host's header over its own moment", async () => {
    await atViewport(PHONE, async () => {
      renderLessonPlayer({
        lesson: buildLesson([teachingStep("check")], {
          summaryIdeas: ["Electrons live in clouds."],
        }),
        slots: {
          completion: () => <h2>Block done</h2>,
          completionHeader: ({ completion, menu }) =>
            completion.status === "saved" ? <header aria-label="Today">{menu}</header> : null,
        },
      });

      await answerRight();
      await expect.element(page.getByRole("heading", { name: "Block done" })).toBeVisible();

      const header = page.getByRole("banner", { name: "Today" });
      await expect.element(header.getByRole("button", { name: "Screen options" })).toBeVisible();
      await header.getByRole("button", { name: "Screen options" }).click();
      await page.getByRole("menuitem", { name: "Lesson summary" }).click();

      const summary = page.getByRole("dialog", { name: "Lesson summary" });
      await expect.element(summary.getByText("Electrons live in clouds.")).toBeVisible();
    });
  });

  it("closes the summary card when a lesson that couldn't save goes back to a screen", async () => {
    await atViewport(PHONE, async () => {
      const lesson = buildLesson([teachingStep("check"), teachingStep("check")], {
        summaryIdeas: ["Electrons live in clouds."],
      });

      const runId = crypto.randomUUID();
      const saving = Promise.withResolvers<{ status: "incomplete" }>();

      const startLesson = vi
        .fn<LessonPlayerAdapters["startLesson"]>()
        .mockResolvedValueOnce(startedRun({ runId }))
        .mockResolvedValue(
          startedRun({ answers: [runAnswer({ stepId: lesson.steps[0]?.id ?? "" })], runId }),
        );

      const completeLesson = vi
        .fn<LessonPlayerAdapters["completeLesson"]>()
        .mockReturnValueOnce(saving.promise)
        .mockImplementation(buildAdapters(lesson).completeLesson);

      renderLessonPlayer({
        adapters: buildAdapters(lesson, { completeLesson, startLesson }),
        lesson,
      });

      await answerRight();
      await answerRight();

      await page.getByRole("button", { name: "Screen options" }).click();
      await page.getByRole("menuitem", { name: "Lesson summary" }).click();

      const summary = page.getByRole("dialog", { name: "Lesson summary" });
      await expect.element(summary).toBeVisible();

      saving.resolve({ status: "incomplete" });

      await expect
        .element(
          page.getByText("Your answer here didn't save. Answer it again to finish the lesson."),
        )
        .toBeVisible();

      await expect.element(summary).not.toBeInTheDocument();
    });
  });

  it("shows a written answer nothing checked next to the sample answer, without calling it wrong", async () => {
    const lesson = buildLesson([teachingStep("typedAnswer"), teachingStep("summary")]);

    const checkStep = vi.fn<LessonPlayerAdapters["checkStep"]>(() =>
      Promise.resolve({
        result: {
          checked: false,
          correctAnswer: "Because it maps chances.",
          corrections: [],
          expected: null,
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

    const checkStep = vi.fn<LessonPlayerAdapters["checkStep"]>(() =>
      Promise.resolve({
        result: {
          checked: true,
          correctAnswer: null,
          corrections: [],
          expected: null,
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

    const checkStep = vi.fn<LessonPlayerAdapters["checkStep"]>(() =>
      Promise.resolve({
        result: {
          checked: true,
          correctAnswer: RIGHT_TYPED,
          corrections: [{ right: "It shows", wrong: "It show" }],
          expected: null,
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

    const corrections = page.getByRole("status").getByRole("listitem");
    await expect.element(corrections.nth(0)).toMatchTextContent("Your answer: It show");
    await expect.element(corrections.nth(1)).toMatchTextContent("Correct answer: It shows");

    await expect.element(page.getByText("2 of 2 key points")).toBeVisible();
    await expect.element(page.getByText("Missing:")).not.toBeInTheDocument();
  });

  it("counts a right answer that left out a detail as right, naming the detail as something to add", async () => {
    const lesson = buildLesson([teachingStep("typedAnswer"), teachingStep("summary")]);

    const feedback =
      "Right: it's where the electron is likely to be. Its exact path can't be known.";

    const checkStep = vi.fn<LessonPlayerAdapters["checkStep"]>(() =>
      Promise.resolve({
        result: {
          checked: true,
          correctAnswer: null,
          corrections: [],
          expected: null,
          feedback,
          isCorrect: true,
          keyPoints: [
            { met: false, text: "We can't know the electron's exact position or path" },
            { met: true, text: "The cloud shows where it's likely to be found" },
          ],
          nextReviewAt: null,
          savedMistake: false,
          score: 0.5,
          spelling: null,
        },
        status: "checked" as const,
      }),
    );

    renderLessonPlayer({ adapters: buildAdapters(lesson, { checkStep }), lesson });

    await page
      .getByRole("textbox", { name: "In your own words: why is the electron drawn as a cloud?" })
      .fill("It shows where the electron probably is");

    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(verdict("Correct!")).toBeVisible();
    await expect.element(page.getByRole("status").getByText(feedback)).toBeVisible();

    await expect.element(page.getByText("1 of 2 key points")).not.toBeInTheDocument();
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

  it("asks which one a definition means when the lesson is in the learner's own language", async () => {
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

    await press("Escape");
    await expect.element(source).not.toBeInTheDocument();
    await expect.element(page.getByText(EXPLANATION_TITLE)).toBeVisible();
  });

  it("shows each screen's own saved personal example, and nothing where none fits", async () => {
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

    const getExampleLine = vi.fn<NonNullable<LessonPlayerAdapters["getExampleLine"]>>(
      ({ stepId }) => Promise.resolve({ line: lines[stepId] ?? null }),
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

    await expect.element(page.getByText("Markups", { exact: true })).toBeVisible();
    await vi.waitFor(() => expect(getExampleLine).toHaveBeenCalledWith({ stepId: markup.id }));
    await expect.element(example).not.toBeInTheDocument();
  });

  it("writes the lesson's personal examples in the background from the learner's first action", async () => {
    const intro = explanationStep({ text: "A percent is a part of a hundred.", title: "Percents" });

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

    const lesson = buildLesson([intro, discount, interest]);
    const line = "At the pharmacy where you work, 25% off a $40 kit saves $10.";
    const writing = Promise.withResolvers<ExampleLine | null>();
    const lessonLines = { written: false };

    const getExampleLine = vi.fn<NonNullable<LessonPlayerAdapters["getExampleLine"]>>(
      ({ stepId }) =>
        Promise.resolve({ line: lessonLines.written && stepId === discount.id ? line : null }),
    );

    const requestExampleLine = vi.fn<NonNullable<LessonPlayerAdapters["requestExampleLine"]>>(
      () => writing.promise,
    );

    renderLessonPlayer({
      adapters: buildAdapters(lesson, { getExampleLine, requestExampleLine }),
      lesson,
    });

    await expect.element(page.getByText("Percents", { exact: true })).toBeVisible();
    expect(requestExampleLine).not.toHaveBeenCalled();
    await page.getByRole("button", { name: /^Next/u }).click();

    const example = page.getByRole("complementary", { name: "Your example" });
    await expect.element(page.getByText("Discounts", { exact: true })).toBeVisible();
    expect(requestExampleLine).toHaveBeenCalledExactlyOnceWith({ stepId: discount.id });
    await expect.element(page.getByRole("button", { name: /example/iu })).not.toBeInTheDocument();
    await expect.element(example).not.toBeInTheDocument();

    lessonLines.written = true;
    writing.resolve({ line });
    await expect.element(example).toHaveTextContent(line);

    await page.getByRole("button", { name: /^Next/u }).click();
    await expect.element(page.getByText("Interest", { exact: true })).toBeVisible();
    await vi.waitFor(() => expect(getExampleLine).toHaveBeenCalledWith({ stepId: interest.id }));
    await expect.element(example).not.toBeInTheDocument();
    expect(requestExampleLine).toHaveBeenCalledOnce();
  });

  it("shows nothing when the background write doesn't go through, without asking again", async () => {
    const intro = explanationStep({ text: "A percent is a part of a hundred.", title: "Percents" });

    const discount = explanationStep({
      exampleLineSlot: { idea: "A discount." },
      text: "A discount lowers the price.",
      title: "Discounts",
    });

    const lesson = buildLesson([intro, discount]);

    const write = { settled: false };
    const readAfterWrite = vi.fn();

    const getExampleLine = vi.fn<NonNullable<LessonPlayerAdapters["getExampleLine"]>>(() => {
      if (write.settled) {
        readAfterWrite();
      }

      return Promise.resolve({ line: null });
    });

    const requestExampleLine = vi.fn<NonNullable<LessonPlayerAdapters["requestExampleLine"]>>(
      () => {
        write.settled = true;
        return Promise.resolve(null);
      },
    );

    renderLessonPlayer({
      adapters: buildAdapters(lesson, { getExampleLine, requestExampleLine }),
      lesson,
    });

    await page.getByRole("button", { name: /^Next/u }).click();
    await expect.element(page.getByText("A discount lowers the price.")).toBeVisible();

    await vi.waitFor(() => expect(readAfterWrite).toHaveBeenCalledWith());
    await expect.element(page.getByRole("button", { name: /example/iu })).not.toBeInTheDocument();

    await expect
      .element(page.getByRole("complementary", { name: "Your example" }))
      .not.toBeInTheDocument();

    await page.getByRole("button", { name: /^Continue/u }).click();
    expect(requestExampleLine).toHaveBeenCalledOnce();
  });

  it("lists a short story's screens beside them on a wide screen, the one in view marked", async () => {
    const lesson = buildLesson([
      explanationStep({ text: "Water molecules spin.", title: "Molecules that spin" }),
      explanationStep({ text: "Spinning makes heat.", title: "From spin to heat" }),
      teachingStep("check"),
    ]);

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

    await page.getByRole("button", { name: /^Next/u }).click();
    await expect.element(outline).not.toBeInTheDocument();

    await expect
      .element(
        page
          .getByRole("complementary", { name: "Help with this screen" })
          .getByText("From the lesson"),
      )
      .toBeVisible();
  });
});
