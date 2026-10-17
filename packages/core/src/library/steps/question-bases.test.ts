import { type WrittenLesson, type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { describe, expect, it } from "vitest";
import { writtenTemperatureLesson } from "../quality/_test-utils/written-lessons";
import { addQuestionBases, findQuestionBases } from "./question-bases";
import { toStepContent } from "./written-screens";

/** The written temperature lesson: 1 guess, 2 explanation, 3 worked example, 4 calculation, 5 explanation, 6 activity, 7 typed answer, 8 check. */
const CALCULATION = 3;
const TYPED_ANSWER = 6;
const APPLICATION = 7;

type Basis = { quote: string; screen: number } | null;

/** The lesson with one question's basis replaced, and, when given, one screen rewritten. */
function lessonWith({
  basis,
  question,
  screen,
}: {
  basis: Basis;
  question: number;
  screen?: { index: number; patch: Partial<WrittenScreen> };
}): WrittenLesson {
  const lesson = writtenTemperatureLesson();

  return {
    ...lesson,
    screens: lesson.screens.map((written, index): WrittenScreen => {
      const patched =
        screen?.index === index ? ({ ...written, ...screen.patch } as WrittenScreen) : written;

      return index === question ? ({ ...patched, basis } as WrittenScreen) : patched;
    }),
  };
}

function convert(lesson: WrittenLesson) {
  return lesson.screens.map((screen) =>
    toStepContent(screen, { allowImage: true, language: "en" }),
  );
}

function find(lesson: WrittenLesson) {
  return findQuestionBases({ lesson, screens: convert(lesson) });
}

describe(findQuestionBases, () => {
  it("keeps a quote copied from an earlier explanation, Markdown marks included", () => {
    const { bases, problems } = find(writtenTemperatureLesson());

    expect(problems).toStrictEqual([]);

    expect(bases).toStrictEqual([
      { question: CALCULATION, quote: "A rise always moves **up** the thermometer.", reading: 1 },
      {
        question: TYPED_ANSWER,
        quote: "Count the degrees to zero, then the degrees after it.",
        reading: 4,
      },
    ]);
  });

  it("keeps a line of a worked example and trims the quote", () => {
    const lesson = lessonWith({
      basis: { quote: " Two degrees are left, so keep going up. ", screen: 3 },
      question: APPLICATION,
    });

    expect(find(lesson).bases).toContainEqual({
      question: APPLICATION,
      quote: "Two degrees are left, so keep going up.",
      reading: 2,
    });
  });

  it("drops a quote that rewords the sentence, with the problem for the eval", () => {
    const lesson = lessonWith({
      basis: { quote: "A rise always goes **up** the thermometer.", screen: 2 },
      question: CALCULATION,
    });

    const { bases, problems } = find(lesson);

    expect(bases.map((basis) => basis.question)).toStrictEqual([TYPED_ANSWER]);

    expect(problems).toStrictEqual([
      {
        problem:
          'Its basis quotes words screen 2 doesn\'t have: "A rise always goes **up** the thermometer.". Copy the sentence exactly as that screen says it.',
        screen: CALCULATION,
      },
    ]);
  });

  it("drops a basis on a screen that isn't an earlier reading screen", () => {
    const quote = "A rise always moves **up** the thermometer.";

    const named = (screen: number) =>
      find(lessonWith({ basis: { quote, screen }, question: CALCULATION })).problems.map(
        (problem) => problem.screen,
      );

    // Itself, a later explanation, the guess before it, a screen that doesn't exist.
    expect(named(4)).toStrictEqual([CALCULATION]);
    expect(named(5)).toStrictEqual([CALCULATION]);
    expect(named(1)).toStrictEqual([CALCULATION]);
    expect(named(0)).toStrictEqual([CALCULATION]);
    expect(named(2)).toStrictEqual([]);
  });

  it("drops a quote that runs over two lines of the screen", () => {
    const lesson = lessonWith({
      basis: { quote: "Zero is just a mark.\nCount the degrees.", screen: 5 },
      question: TYPED_ANSWER,
      screen: { index: 4, patch: { text: "Zero is just a mark.\nCount the degrees." } },
    });

    expect(find(lesson).problems.map((problem) => problem.screen)).toStrictEqual([TYPED_ANSWER]);
  });

  it("matches a quote with an em dash the way both texts are stored", () => {
    const text = "Zero is a mark — count the degrees to it, then past it.";

    const lesson = lessonWith({
      basis: { quote: text, screen: 5 },
      question: TYPED_ANSWER,
      screen: { index: 4, patch: { text } },
    });

    expect(find(lesson).bases).toContainEqual({
      question: TYPED_ANSWER,
      quote: "Zero is a mark, count the degrees to it, then past it.",
      reading: 4,
    });
  });

  it("finds nothing for questions without a basis", () => {
    const lesson = lessonWith({ basis: null, question: CALCULATION });
    expect(find(lesson).bases.map((basis) => basis.question)).toStrictEqual([TYPED_ANSWER]);
  });
});

describe(addQuestionBases, () => {
  const lesson = writtenTemperatureLesson();
  const screens = convert(lesson);

  const contentAt = (converted: ReturnType<typeof convert>, index: number) =>
    converted[index]?.ok ? converted[index].content : null;

  it("stores each basis with the position its reading screen is stored at", () => {
    // The guess isn't stored, so every later screen moves up one.
    const positions = screens.map((_, index) => (index === 0 ? null : index - 1));
    const withBases = addQuestionBases({ lesson, positions, screens });

    expect(contentAt(withBases, CALCULATION)).toMatchObject({
      basis: { position: 0, quote: "A rise always moves **up** the thermometer." },
    });

    expect(contentAt(withBases, TYPED_ANSWER)).toMatchObject({
      basis: { position: 3, quote: "Count the degrees to zero, then the degrees after it." },
    });

    expect(contentAt(withBases, APPLICATION)).not.toHaveProperty("basis");
  });

  it("leaves a question without a basis when its reading screen isn't stored", () => {
    const positions = screens.map((_, index) => (index === 1 ? null : index));
    const withBases = addQuestionBases({ lesson, positions, screens });

    expect(contentAt(withBases, CALCULATION)).not.toHaveProperty("basis");
    expect(contentAt(withBases, TYPED_ANSWER)).toHaveProperty("basis.position", 4);
  });
});
