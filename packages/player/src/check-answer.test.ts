import {
  type FillBlankStepContent,
  type MatchColumnsStepContent,
  type MultipleChoiceStepContent,
  type SelectImageStepContent,
  type SortOrderStepContent,
} from "@zoonk/core/steps/content-contract";
import { describe, expect, test } from "vitest";
import {
  checkArrangeWordsAnswer,
  checkFillBlankAnswer,
  checkMatchColumnsAnswer,
  checkMultipleChoiceAnswer,
  checkSelectImageAnswer,
  checkSingleMatchPair,
  checkSortOrderAnswer,
  checkVocabularyAnswer,
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
        feedback: "Correct!",
        isCorrect: true,
      });
    });

    test("returns incorrect with feedback for wrong index", () => {
      expect(checkMultipleChoiceAnswer(content, 1)).toEqual({
        feedback: "Wrong.",
        isCorrect: false,
      });
    });

    test("returns incorrect with null feedback for out-of-bounds index", () => {
      expect(checkMultipleChoiceAnswer(content, 5)).toEqual({
        feedback: null,
        isCorrect: false,
      });
    });
  });

  describe("challenge kind", () => {
    const content: MultipleChoiceStepContent = {
      context: "You face a decision.",
      kind: "challenge",
      options: [
        {
          consequence: "Good outcome",
          effects: [{ dimension: "Quality", impact: "positive" }],
          text: "Option A",
        },
        {
          consequence: "Bad outcome",
          effects: [{ dimension: "Quality", impact: "negative" }],
          text: "Option B",
        },
      ],
      question: "What do you do?",
    };

    test("always returns correct with consequence as feedback", () => {
      expect(checkMultipleChoiceAnswer(content, 0)).toEqual({
        feedback: "Good outcome",
        isCorrect: true,
      });
    });

    test("returns correct for any valid index", () => {
      expect(checkMultipleChoiceAnswer(content, 1)).toEqual({
        feedback: "Bad outcome",
        isCorrect: true,
      });
    });

    test("returns incorrect with null feedback for out-of-bounds index", () => {
      expect(checkMultipleChoiceAnswer(content, 10)).toEqual({
        feedback: null,
        isCorrect: false,
      });
    });
  });

  describe("language kind", () => {
    const content: MultipleChoiceStepContent = {
      context: "You enter a bakery.",
      contextRomanization: null,
      contextTranslation: "You enter a bakery.",
      kind: "language",
      options: [
        { feedback: "Great!", isCorrect: true, text: "Buenos días", textRomanization: null },
        { feedback: "Not quite.", isCorrect: false, text: "Adiós", textRomanization: null },
      ],
    };

    test("returns correct with feedback for correct index", () => {
      expect(checkMultipleChoiceAnswer(content, 0)).toEqual({
        feedback: "Great!",
        isCorrect: true,
      });
    });

    test("returns incorrect with feedback for wrong index", () => {
      expect(checkMultipleChoiceAnswer(content, 1)).toEqual({
        feedback: "Not quite.",
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
      feedback: "Use first person singular.",
      isCorrect: true,
    });
  });

  test("returns correct for case-insensitive match", () => {
    expect(checkFillBlankAnswer(content, ["HABLO", "ESPAÑOL"])).toEqual({
      feedback: "Use first person singular.",
      isCorrect: true,
    });
  });

  test("returns correct with trimmed whitespace", () => {
    expect(checkFillBlankAnswer(content, ["  hablo  ", " español "])).toEqual({
      feedback: "Use first person singular.",
      isCorrect: true,
    });
  });

  test("returns incorrect for wrong answer", () => {
    expect(checkFillBlankAnswer(content, ["habla", "español"])).toEqual({
      feedback: "Use first person singular.",
      isCorrect: false,
    });
  });

  test("returns incorrect when user provides extra answers", () => {
    expect(checkFillBlankAnswer(content, ["hablo", "español", "extra"])).toEqual({
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
    expect(checkSingleMatchPair(content, { left: "A", right: "1" })).toBeTruthy();
  });

  test("returns false for an incorrect pair", () => {
    expect(checkSingleMatchPair(content, { left: "A", right: "2" })).toBeFalsy();
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
      feedback: null,
      isCorrect: false,
    });
  });

  test("returns incorrect when counts differ", () => {
    const userPairs = [{ left: "A", right: "1" }];

    expect(checkMatchColumnsAnswer(content, userPairs, 0)).toEqual({
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
      feedback: "Correct order.",
      isCorrect: true,
    });
  });

  test("returns incorrect for wrong order", () => {
    expect(checkSortOrderAnswer(content, ["three", "two", "one"])).toEqual({
      feedback: "Correct order.",
      isCorrect: false,
    });
  });

  test("returns incorrect when user provides extra entries", () => {
    expect(checkSortOrderAnswer(content, ["one", "two", "three", "four"])).toEqual({
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
      feedback: "Yes, a cat!",
      isCorrect: true,
    });
  });

  test("returns incorrect with feedback for wrong index", () => {
    expect(checkSelectImageAnswer(content, 1)).toEqual({
      feedback: "That's a dog.",
      isCorrect: false,
    });
  });

  test("returns incorrect with null feedback for out-of-bounds index", () => {
    expect(checkSelectImageAnswer(content, 99)).toEqual({
      feedback: null,
      isCorrect: false,
    });
  });
});

describe(checkVocabularyAnswer, () => {
  test("returns correct for matching IDs", () => {
    expect(checkVocabularyAnswer("word-1", "word-1")).toEqual({
      feedback: null,
      isCorrect: true,
    });
  });

  test("returns incorrect for non-matching IDs", () => {
    expect(checkVocabularyAnswer("word-1", "word-2")).toEqual({
      feedback: null,
      isCorrect: false,
    });
  });
});

describe(checkArrangeWordsAnswer, () => {
  test("returns correct for matching sequence", () => {
    expect(checkArrangeWordsAnswer(["I", "speak", "Spanish"], ["I", "speak", "Spanish"])).toEqual({
      feedback: null,
      isCorrect: true,
    });
  });

  test("returns incorrect for wrong sequence", () => {
    expect(checkArrangeWordsAnswer(["I", "speak", "Spanish"], ["Spanish", "I", "speak"])).toEqual({
      feedback: null,
      isCorrect: false,
    });
  });

  test("returns incorrect when user provides extra words", () => {
    expect(
      checkArrangeWordsAnswer(["I", "speak", "Spanish"], ["I", "speak", "Spanish", "well"]),
    ).toEqual({
      feedback: null,
      isCorrect: false,
    });
  });
});
