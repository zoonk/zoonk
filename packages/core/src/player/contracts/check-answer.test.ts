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
  checkTranslationAnswer,
} from "./check-answer";

describe(checkMultipleChoiceAnswer, () => {
  describe("core kind", () => {
    const content: MultipleChoiceStepContent = {
      kind: "core",
      options: [
        { feedback: "Correct!", id: "a", isCorrect: true, text: "A" },
        { feedback: "Wrong.", id: "b", isCorrect: false, text: "B" },
      ],
    };

    test("returns correct with feedback for correct text", () => {
      expect(checkMultipleChoiceAnswer(content, "a")).toEqual({
        correctAnswer: "A",
        feedback: "Correct!",
        isCorrect: true,
      });
    });

    test("returns incorrect with feedback for wrong text", () => {
      expect(checkMultipleChoiceAnswer(content, "b")).toEqual({
        correctAnswer: "A",
        feedback: "Wrong.",
        isCorrect: false,
      });
    });

    test("returns incorrect with null feedback for unknown text", () => {
      expect(checkMultipleChoiceAnswer(content, "missing")).toEqual({
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
      { feedback: "Yes, a cat!", id: "cat", isCorrect: true, prompt: "A cat" },
      { feedback: "That's a dog.", id: "dog", isCorrect: false, prompt: "A dog" },
    ],
    question: "Which image shows a cat?",
  };

  test("returns correct with feedback for correct option id", () => {
    expect(checkSelectImageAnswer(content, "cat")).toEqual({
      correctAnswer: null,
      feedback: "Yes, a cat!",
      isCorrect: true,
    });
  });

  test("returns incorrect with feedback for wrong option id", () => {
    expect(checkSelectImageAnswer(content, "dog")).toEqual({
      correctAnswer: null,
      feedback: "That's a dog.",
      isCorrect: false,
    });
  });

  test("returns incorrect with null feedback for unknown option id", () => {
    expect(checkSelectImageAnswer(content, "missing")).toEqual({
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
