import {
  type FillBlankStepContent,
  type MatchColumnsStepContent,
  type MultipleChoiceStepContent,
  type SelectImageStepContent,
  type SortOrderStepContent,
} from "@zoonk/core/steps/contract/content";
import { describe, expect, it } from "vitest";
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
  describe("multipleChoice content", () => {
    const content: MultipleChoiceStepContent = {
      options: [
        { feedback: "Correct!", id: "a", isCorrect: true, text: "A" },
        { feedback: "Wrong.", id: "b", isCorrect: false, text: "B" },
      ],
    };

    it("returns correct with feedback for correct text", () => {
      expect(checkMultipleChoiceAnswer(content, "a")).toStrictEqual({
        correctAnswer: "A",
        feedback: "Correct!",
        isCorrect: true,
      });
    });

    it("returns incorrect with feedback for wrong text", () => {
      expect(checkMultipleChoiceAnswer(content, "b")).toStrictEqual({
        correctAnswer: "A",
        feedback: "Wrong.",
        isCorrect: false,
      });
    });

    it("returns incorrect with null feedback for unknown text", () => {
      expect(checkMultipleChoiceAnswer(content, "missing")).toStrictEqual({
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

  it("returns correct for exact match", () => {
    expect(checkFillBlankAnswer(content, ["hablo", "español"])).toStrictEqual({
      correctAnswer: null,
      feedback: "Use first person singular.",
      isCorrect: true,
    });
  });

  it("returns correct for case-insensitive match", () => {
    expect(checkFillBlankAnswer(content, ["HABLO", "ESPAÑOL"])).toStrictEqual({
      correctAnswer: null,
      feedback: "Use first person singular.",
      isCorrect: true,
    });
  });

  it("returns correct with trimmed whitespace", () => {
    expect(checkFillBlankAnswer(content, ["  hablo  ", " español "])).toStrictEqual({
      correctAnswer: null,
      feedback: "Use first person singular.",
      isCorrect: true,
    });
  });

  it("returns incorrect for wrong answer", () => {
    expect(checkFillBlankAnswer(content, ["habla", "español"])).toStrictEqual({
      correctAnswer: null,
      feedback: "Use first person singular.",
      isCorrect: false,
    });
  });

  it("returns incorrect when user provides extra answers", () => {
    expect(checkFillBlankAnswer(content, ["hablo", "español", "extra"])).toStrictEqual({
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

  it("returns true for a correct pair", () => {
    expect(checkSingleMatchPair(content, { left: "A", right: "1" })).toBe(true);
  });

  it("returns false for an incorrect pair", () => {
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

  it("returns correct when all pairs match with no mistakes", () => {
    const userPairs = [
      { left: "A", right: "1" },
      { left: "B", right: "2" },
    ];

    expect(checkMatchColumnsAnswer(content, userPairs, 0)).toStrictEqual({
      correctAnswer: null,
      feedback: null,
      isCorrect: true,
    });
  });

  it("returns correct when all pairs match in different order with no mistakes", () => {
    const userPairs = [
      { left: "B", right: "2" },
      { left: "A", right: "1" },
    ];

    expect(checkMatchColumnsAnswer(content, userPairs, 0)).toStrictEqual({
      correctAnswer: null,
      feedback: null,
      isCorrect: true,
    });
  });

  it("returns incorrect when all pairs match but mistakes > 0", () => {
    const userPairs = [
      { left: "A", right: "1" },
      { left: "B", right: "2" },
    ];

    expect(checkMatchColumnsAnswer(content, userPairs, 1)).toStrictEqual({
      correctAnswer: null,
      feedback: null,
      isCorrect: false,
    });
  });

  it("returns incorrect when a pair is wrong", () => {
    const userPairs = [
      { left: "A", right: "2" },
      { left: "B", right: "1" },
    ];

    expect(checkMatchColumnsAnswer(content, userPairs, 0)).toStrictEqual({
      correctAnswer: null,
      feedback: null,
      isCorrect: false,
    });
  });

  it("returns incorrect when counts differ", () => {
    const userPairs = [{ left: "A", right: "1" }];

    expect(checkMatchColumnsAnswer(content, userPairs, 0)).toStrictEqual({
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

  it("returns correct for matching order", () => {
    expect(checkSortOrderAnswer(content, ["one", "two", "three"])).toStrictEqual({
      correctAnswer: null,
      feedback: "Correct order.",
      isCorrect: true,
    });
  });

  it("returns incorrect for wrong order", () => {
    expect(checkSortOrderAnswer(content, ["three", "two", "one"])).toStrictEqual({
      correctAnswer: null,
      feedback: "Correct order.",
      isCorrect: false,
    });
  });

  it("returns incorrect when user provides extra entries", () => {
    expect(checkSortOrderAnswer(content, ["one", "two", "three", "four"])).toStrictEqual({
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

  it("returns correct with feedback for correct option id", () => {
    expect(checkSelectImageAnswer(content, "cat")).toStrictEqual({
      correctAnswer: null,
      feedback: "Yes, a cat!",
      isCorrect: true,
    });
  });

  it("returns incorrect with feedback for wrong option id", () => {
    expect(checkSelectImageAnswer(content, "dog")).toStrictEqual({
      correctAnswer: null,
      feedback: "That's a dog.",
      isCorrect: false,
    });
  });

  it("returns incorrect with null feedback for unknown option id", () => {
    expect(checkSelectImageAnswer(content, "missing")).toStrictEqual({
      correctAnswer: null,
      feedback: null,
      isCorrect: false,
    });
  });
});

describe(checkTranslationAnswer, () => {
  it("returns correct for matching IDs", () => {
    expect(checkTranslationAnswer("word-1", "word-1")).toStrictEqual({
      correctAnswer: null,
      feedback: null,
      isCorrect: true,
    });
  });

  it("returns incorrect for non-matching IDs", () => {
    expect(checkTranslationAnswer("word-1", "word-2")).toStrictEqual({
      correctAnswer: null,
      feedback: null,
      isCorrect: false,
    });
  });
});

describe(checkArrangeWordsAnswer, () => {
  it("returns correct for matching sequence", () => {
    expect(
      checkArrangeWordsAnswer([["I", "speak", "Spanish"]], ["I", "speak", "Spanish"]),
    ).toStrictEqual({ correctAnswer: null, feedback: null, isCorrect: true });
  });

  it("returns incorrect for wrong sequence", () => {
    expect(
      checkArrangeWordsAnswer([["I", "speak", "Spanish"]], ["Spanish", "I", "speak"]),
    ).toStrictEqual({ correctAnswer: null, feedback: null, isCorrect: false });
  });

  it("returns incorrect when user provides extra words", () => {
    expect(
      checkArrangeWordsAnswer([["I", "speak", "Spanish"]], ["I", "speak", "Spanish", "well"]),
    ).toStrictEqual({ correctAnswer: null, feedback: null, isCorrect: false });
  });

  it("accepts an alternative valid sequence", () => {
    expect(
      checkArrangeWordsAnswer(
        [
          ["Guten", "Tag"],
          ["Guten", "Morgen"],
        ],
        ["Guten", "Morgen"],
      ),
    ).toStrictEqual({ correctAnswer: null, feedback: null, isCorrect: true });
  });

  it("matches case and punctuation insensitively", () => {
    expect(checkArrangeWordsAnswer([["Hello,", "Lara!"]], ["hello", "lara"])).toStrictEqual({
      correctAnswer: null,
      feedback: null,
      isCorrect: true,
    });
  });
});
