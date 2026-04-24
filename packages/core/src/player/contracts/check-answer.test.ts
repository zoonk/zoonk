import {
  type FillBlankStepContent,
  type MatchColumnsStepContent,
  type MultipleChoiceStepContent,
  type SelectImageStepContent,
  type SortOrderStepContent,
} from "@zoonk/core/steps/contract/content";
import { describe, expect, test } from "vitest";
import {
  checkArrangeWordsAnswer,
  checkFillBlankAnswer,
  checkMatchColumnsAnswer,
  checkMultipleChoiceAnswer,
  checkSelectImageAnswer,
  checkSingleMatchPair,
  checkSortOrderAnswer,
  checkStoryAnswer,
  checkTranslationAnswer,
} from "./check-answer";

describe(checkMultipleChoiceAnswer, () => {
  describe("core kind", () => {
    const content: MultipleChoiceStepContent = {
      kind: "core",
      options: [
        { feedback: "Correct!", isCorrect: true, text: "A" },
        { feedback: "Wrong.", isCorrect: false, text: "B" },
      ],
    };

    test("returns correct with feedback for correct index", () => {
      expect(checkMultipleChoiceAnswer(content, 0)).toEqual({
        correctAnswer: "A",
        feedback: "Correct!",
        isCorrect: true,
      });
    });

    test("returns incorrect with feedback for wrong index", () => {
      expect(checkMultipleChoiceAnswer(content, 1)).toEqual({
        correctAnswer: "A",
        feedback: "Wrong.",
        isCorrect: false,
      });
    });

    test("returns incorrect with null feedback for out-of-bounds index", () => {
      expect(checkMultipleChoiceAnswer(content, 5)).toEqual({
        correctAnswer: "A",
        feedback: null,
        isCorrect: false,
      });
    });
  });
});

describe(checkFillBlankAnswer, () => {
  const content: FillBlankStepContent = {
    answers: ["hablo", "español"],
    distractors: ["habla"],
    feedback: "Use first person singular.",
    template: "Yo [BLANK] [BLANK].",
  };

  test("returns correct for exact match", () => {
    expect(checkFillBlankAnswer(content, ["hablo", "español"])).toEqual({
      correctAnswer: null,
      feedback: "Use first person singular.",
      isCorrect: true,
    });
  });

  test("returns correct for case-insensitive match", () => {
    expect(checkFillBlankAnswer(content, ["HABLO", "ESPAÑOL"])).toEqual({
      correctAnswer: null,
      feedback: "Use first person singular.",
      isCorrect: true,
    });
  });

  test("returns correct with trimmed whitespace", () => {
    expect(checkFillBlankAnswer(content, ["  hablo  ", " español "])).toEqual({
      correctAnswer: null,
      feedback: "Use first person singular.",
      isCorrect: true,
    });
  });

  test("returns incorrect for wrong answer", () => {
    expect(checkFillBlankAnswer(content, ["habla", "español"])).toEqual({
      correctAnswer: null,
      feedback: "Use first person singular.",
      isCorrect: false,
    });
  });

  test("returns incorrect when user provides extra answers", () => {
    expect(checkFillBlankAnswer(content, ["hablo", "español", "extra"])).toEqual({
      correctAnswer: null,
      feedback: "Use first person singular.",
      isCorrect: false,
    });
  });
});

describe(checkSingleMatchPair, () => {
  const content: MatchColumnsStepContent = {
    pairs: [
      { left: "A", right: "1" },
      { left: "B", right: "2" },
    ],
    question: "Match the items.",
  };

  test("returns true for a correct pair", () => {
    expect(checkSingleMatchPair(content, { left: "A", right: "1" })).toBe(true);
  });

  test("returns false for an incorrect pair", () => {
    expect(checkSingleMatchPair(content, { left: "A", right: "2" })).toBe(false);
  });
});

describe(checkMatchColumnsAnswer, () => {
  const content: MatchColumnsStepContent = {
    pairs: [
      { left: "A", right: "1" },
      { left: "B", right: "2" },
    ],
    question: "Match the items.",
  };

  test("returns correct when all pairs match with no mistakes", () => {
    const userPairs = [
      { left: "A", right: "1" },
      { left: "B", right: "2" },
    ];

    expect(checkMatchColumnsAnswer(content, userPairs, 0)).toEqual({
      correctAnswer: null,
      feedback: null,
      isCorrect: true,
    });
  });

  test("returns correct when all pairs match in different order with no mistakes", () => {
    const userPairs = [
      { left: "B", right: "2" },
      { left: "A", right: "1" },
    ];

    expect(checkMatchColumnsAnswer(content, userPairs, 0)).toEqual({
      correctAnswer: null,
      feedback: null,
      isCorrect: true,
    });
  });

  test("returns incorrect when all pairs match but mistakes > 0", () => {
    const userPairs = [
      { left: "A", right: "1" },
      { left: "B", right: "2" },
    ];

    expect(checkMatchColumnsAnswer(content, userPairs, 1)).toEqual({
      correctAnswer: null,
      feedback: null,
      isCorrect: false,
    });
  });

  test("returns incorrect when a pair is wrong", () => {
    const userPairs = [
      { left: "A", right: "2" },
      { left: "B", right: "1" },
    ];

    expect(checkMatchColumnsAnswer(content, userPairs, 0)).toEqual({
      correctAnswer: null,
      feedback: null,
      isCorrect: false,
    });
  });

  test("returns incorrect when counts differ", () => {
    const userPairs = [{ left: "A", right: "1" }];

    expect(checkMatchColumnsAnswer(content, userPairs, 0)).toEqual({
      correctAnswer: null,
      feedback: null,
      isCorrect: false,
    });
  });
});

describe(checkSortOrderAnswer, () => {
  const content: SortOrderStepContent = {
    feedback: "Correct order.",
    items: ["one", "two", "three"],
    question: "Sort these items.",
  };

  test("returns correct for matching order", () => {
    expect(checkSortOrderAnswer(content, ["one", "two", "three"])).toEqual({
      correctAnswer: null,
      feedback: "Correct order.",
      isCorrect: true,
    });
  });

  test("returns incorrect for wrong order", () => {
    expect(checkSortOrderAnswer(content, ["three", "two", "one"])).toEqual({
      correctAnswer: null,
      feedback: "Correct order.",
      isCorrect: false,
    });
  });

  test("returns incorrect when user provides extra entries", () => {
    expect(checkSortOrderAnswer(content, ["one", "two", "three", "four"])).toEqual({
      correctAnswer: null,
      feedback: "Correct order.",
      isCorrect: false,
    });
  });
});

describe(checkSelectImageAnswer, () => {
  const content: SelectImageStepContent = {
    options: [
      { feedback: "Yes, a cat!", isCorrect: true, prompt: "A cat" },
      { feedback: "That's a dog.", isCorrect: false, prompt: "A dog" },
    ],
    question: "Which image shows a cat?",
  };

  test("returns correct with feedback for correct index", () => {
    expect(checkSelectImageAnswer(content, 0)).toEqual({
      correctAnswer: null,
      feedback: "Yes, a cat!",
      isCorrect: true,
    });
  });

  test("returns incorrect with feedback for wrong index", () => {
    expect(checkSelectImageAnswer(content, 1)).toEqual({
      correctAnswer: null,
      feedback: "That's a dog.",
      isCorrect: false,
    });
  });

  test("returns incorrect with null feedback for out-of-bounds index", () => {
    expect(checkSelectImageAnswer(content, 99)).toEqual({
      correctAnswer: null,
      feedback: null,
      isCorrect: false,
    });
  });
});

describe(checkTranslationAnswer, () => {
  test("returns correct for matching IDs", () => {
    expect(checkTranslationAnswer("word-1", "word-1")).toEqual({
      correctAnswer: null,
      feedback: null,
      isCorrect: true,
    });
  });

  test("returns incorrect for non-matching IDs", () => {
    expect(checkTranslationAnswer("word-1", "word-2")).toEqual({
      correctAnswer: null,
      feedback: null,
      isCorrect: false,
    });
  });
});

describe(checkStoryAnswer, () => {
  const content = {
    choices: [
      {
        alignment: "strong" as const,
        consequence: "Things improve.",
        id: "1a",
        metricEffects: [{ effect: "positive" as const, metric: "Production" }],
        stateImage: { prompt: "State after the strong choice" },
        text: "Strong choice",
      },
      {
        alignment: "partial" as const,
        consequence: "Mixed results.",
        id: "1b",
        metricEffects: [{ effect: "neutral" as const, metric: "Production" }],
        stateImage: { prompt: "State after the partial choice" },
        text: "Partial choice",
      },
      {
        alignment: "weak" as const,
        consequence: "Things get worse.",
        id: "1c",
        metricEffects: [{ effect: "negative" as const, metric: "Production" }],
        stateImage: { prompt: "State after the weak choice" },
        text: "Weak choice",
      },
    ],
    problem: "You face a decision.",
  };

  test("strong alignment is correct with consequence as feedback", () => {
    expect(checkStoryAnswer(content, "1a")).toEqual({
      correctAnswer: null,
      feedback: "Things improve.",
      isCorrect: true,
    });
  });

  test("partial alignment is correct with consequence as feedback", () => {
    expect(checkStoryAnswer(content, "1b")).toEqual({
      correctAnswer: null,
      feedback: "Mixed results.",
      isCorrect: true,
    });
  });

  test("weak alignment is incorrect with consequence as feedback", () => {
    expect(checkStoryAnswer(content, "1c")).toEqual({
      correctAnswer: null,
      feedback: "Things get worse.",
      isCorrect: false,
    });
  });

  test("unknown choice ID is incorrect with null feedback", () => {
    expect(checkStoryAnswer(content, "unknown")).toEqual({
      correctAnswer: null,
      feedback: null,
      isCorrect: false,
    });
  });
});

describe(checkArrangeWordsAnswer, () => {
  test("returns correct for matching sequence", () => {
    expect(checkArrangeWordsAnswer([["I", "speak", "Spanish"]], ["I", "speak", "Spanish"])).toEqual(
      {
        correctAnswer: null,
        feedback: null,
        isCorrect: true,
      },
    );
  });

  test("returns incorrect for wrong sequence", () => {
    expect(checkArrangeWordsAnswer([["I", "speak", "Spanish"]], ["Spanish", "I", "speak"])).toEqual(
      {
        correctAnswer: null,
        feedback: null,
        isCorrect: false,
      },
    );
  });

  test("returns incorrect when user provides extra words", () => {
    expect(
      checkArrangeWordsAnswer([["I", "speak", "Spanish"]], ["I", "speak", "Spanish", "well"]),
    ).toEqual({
      correctAnswer: null,
      feedback: null,
      isCorrect: false,
    });
  });

  test("accepts an alternative valid sequence", () => {
    expect(
      checkArrangeWordsAnswer(
        [
          ["Guten", "Tag"],
          ["Guten", "Morgen"],
        ],
        ["Guten", "Morgen"],
      ),
    ).toEqual({
      correctAnswer: null,
      feedback: null,
      isCorrect: true,
    });
  });

  test("matches case and punctuation insensitively", () => {
    expect(checkArrangeWordsAnswer([["Hello,", "Lara!"]], ["hello", "lara"])).toEqual({
      correctAnswer: null,
      feedback: null,
      isCorrect: true,
    });
  });
});
