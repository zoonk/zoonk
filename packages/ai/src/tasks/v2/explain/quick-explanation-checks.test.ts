import { describe, expect, it } from "vitest";
import { type QuickExplanation } from "./quick-explanation";
import { checkQuickExplanation } from "./quick-explanation-checks";

function screen(index: number) {
  return { imagePrompt: null, text: `Idea number ${index}.`, title: `Idea ${index}` };
}

const validExplanation: QuickExplanation = {
  check: {
    options: [
      { feedback: "Right: the water heats up.", isCorrect: true, text: "The soup" },
      { feedback: "Plates barely warm.", isCorrect: false, text: "The plate" },
      { feedback: "Air isn't heated directly.", isCorrect: false, text: "The air" },
    ],
    question: "What gets hot first?",
  },
  goFurther: {
    overviewCourse: "Physics",
    relatedQuestions: ["Why does metal spark?", "Is it safe?"],
  },
  recap: ["Microwaves shake water.", "Shaking makes heat.", "Heat spreads inward."],
  screens: [screen(1), screen(2), screen(3), screen(4)],
  title: "How a microwave heats food",
};

describe(checkQuickExplanation, () => {
  it("passes a well-formed explanation", () => {
    expect(checkQuickExplanation(validExplanation)).toStrictEqual([]);
  });

  it("requires exactly one correct option", () => {
    const noCorrect = {
      ...validExplanation,
      check: {
        ...validExplanation.check,
        options: validExplanation.check.options.map((option) => ({ ...option, isCorrect: false })),
      },
    };

    const twoCorrect = {
      ...validExplanation,
      check: {
        ...validExplanation.check,
        options: validExplanation.check.options.map((option, index) => ({
          ...option,
          isCorrect: index < 2,
        })),
      },
    };

    expect(checkQuickExplanation(noCorrect)).toStrictEqual([
      "The check has 0 correct options instead of 1.",
    ]);

    expect(checkQuickExplanation(twoCorrect)).toStrictEqual([
      "The check has 2 correct options instead of 1.",
    ]);
  });

  it("rejects options a learner can't tell apart", () => {
    const [first, second, third] = validExplanation.check.options;

    const explanation = {
      ...validExplanation,
      check: {
        ...validExplanation.check,
        options: [first!, { ...second!, text: " the SOUP " }, third!],
      },
    };

    expect(checkQuickExplanation(explanation)).toStrictEqual(["Two check options are the same."]);
  });

  it("keeps the story between 4 and 6 screens", () => {
    const short = { ...validExplanation, screens: [screen(1), screen(2), screen(3)] };

    const long = {
      ...validExplanation,
      screens: [1, 2, 3, 4, 5, 6, 7].map((index) => screen(index)),
    };

    expect(checkQuickExplanation(short)).toStrictEqual(["Has 3 screens instead of 4 to 6."]);
    expect(checkQuickExplanation(long)).toStrictEqual(["Has 7 screens instead of 4 to 6."]);
  });

  it("reports repeated screens and recap bullets", () => {
    const explanation = {
      ...validExplanation,
      recap: ["Same idea.", "same idea.", "Another idea."],
      screens: [screen(1), screen(1), screen(3), screen(4)],
    };

    expect(checkQuickExplanation(explanation)).toStrictEqual([
      "Two screens share a title.",
      "Two recap bullets are the same.",
    ]);
  });
});
