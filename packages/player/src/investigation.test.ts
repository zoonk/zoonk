import {
  checkInvestigationAction,
  checkInvestigationCall,
} from "@zoonk/core/player/contracts/check-answer";
import {
  type InvestigationScoreInput,
  computeActivityScore,
} from "@zoonk/core/player/contracts/compute-score";
import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { shuffle } from "@zoonk/utils/shuffle";
import { describe, expect, test } from "vitest";
import { getAvailableActions, getInvestigationStepByVariant } from "./investigation";

function buildStep(overrides: Partial<SerializedStep> = {}): SerializedStep {
  return {
    content: { text: "Hello", title: "Intro", variant: "text" as const },
    fillBlankOptions: [],
    id: "step-1",
    kind: "static",
    matchColumnsRightItems: [],
    position: 0,
    sentence: null,
    sentenceWordOptions: [],
    sortOrderItems: [],
    translationOptions: [],
    vocabularyOptions: [],
    word: null,
    wordBankOptions: [],
    ...overrides,
  };
}

const problemContent = {
  scenario: "API errors",
  variant: "problem" as const,
};

const actionContent = {
  options: [
    {
      feedback: "Logs show memory climbing",
      id: "a1",
      quality: "critical" as const,
      text: "Check logs",
    },
    {
      feedback: "Witness saw restart",
      id: "a2",
      quality: "useful" as const,
      text: "Ask witness",
    },
    {
      feedback: "Nothing useful here",
      id: "a3",
      quality: "weak" as const,
      text: "Random check",
    },
  ],
  variant: "action" as const,
};

const callContent = {
  options: [
    {
      accuracy: "best" as const,
      feedback: "Correct — memory leak.",
      id: "e1",
      text: "Memory leak",
    },
    {
      accuracy: "partial" as const,
      feedback: "Partially right.",
      id: "e2",
      text: "DB pool exhausted",
    },
    { accuracy: "wrong" as const, feedback: "Not supported.", id: "e3", text: "Network failure" },
  ],
  variant: "call" as const,
};

function buildInvestigationSteps(): SerializedStep[] {
  return [
    buildStep({ content: problemContent, id: "problem-step", kind: "investigation", position: 0 }),
    buildStep({ content: actionContent, id: "action-step", kind: "investigation", position: 1 }),
    buildStep({ content: callContent, id: "call-step", kind: "investigation", position: 2 }),
  ];
}

describe("computeActivityScore (investigation)", () => {
  test("perfect score: 2 critical actions, best call = 3/3", () => {
    const input: InvestigationScoreInput = {
      actionQualities: ["critical", "critical"],
      callAccuracy: "best",
    };

    const result = computeActivityScore({ investigation: input, kind: "investigation" });
    expect(result.brainPower).toBe(100);
    expect(result.correctCount).toBe(3);
    expect(result.incorrectCount).toBe(0);
  });

  test("minimum score: 1 weak action, wrong call = 0/2", () => {
    const input: InvestigationScoreInput = {
      actionQualities: ["weak"],
      callAccuracy: "wrong",
    };

    const result = computeActivityScore({ investigation: input, kind: "investigation" });
    expect(result.brainPower).toBe(100);
    expect(result.correctCount).toBe(0);
    expect(result.incorrectCount).toBe(2);
  });

  test("partial call accuracy counts as incorrect: 1 critical + partial = 1/2", () => {
    const input: InvestigationScoreInput = {
      actionQualities: ["critical"],
      callAccuracy: "partial",
    };

    const result = computeActivityScore({ investigation: input, kind: "investigation" });
    expect(result.correctCount).toBe(1);
    expect(result.incorrectCount).toBe(1);
  });
});

describe(getAvailableActions, () => {
  const actions = [
    { id: "a1", quality: "critical" as const, text: "Check logs" },
    { id: "a2", quality: "useful" as const, text: "Ask witness" },
    { id: "a3", quality: "weak" as const, text: "Read docs" },
  ];

  test("returns all actions when none used", () => {
    const available = getAvailableActions(actions, []);
    expect(available).toHaveLength(3);
    expect(available[0]?.id).toBe("a1");
    expect(available[1]?.id).toBe("a2");
    expect(available[2]?.id).toBe("a3");
  });

  test("filters out used action IDs", () => {
    const available = getAvailableActions(actions, ["a1", "a3"]);
    expect(available).toHaveLength(1);
    expect(available[0]?.id).toBe("a2");
    expect(available[0]?.text).toBe("Ask witness");
  });

  test("returns empty when all actions used", () => {
    const available = getAvailableActions(actions, ["a1", "a2", "a3"]);
    expect(available).toHaveLength(0);
  });
});

describe(getInvestigationStepByVariant, () => {
  test("finds the problem step", () => {
    const steps = buildInvestigationSteps();
    const step = getInvestigationStepByVariant(steps, "problem");
    expect(step?.id).toBe("problem-step");
  });

  test("finds the action step", () => {
    const steps = buildInvestigationSteps();
    const step = getInvestigationStepByVariant(steps, "action");
    expect(step?.id).toBe("action-step");
  });

  test("returns null when variant not found", () => {
    const steps = [buildStep({ id: "s1", kind: "static" })];
    const step = getInvestigationStepByVariant(steps, "problem");
    expect(step).toBeNull();
  });
});

describe("server/client agreement after shuffling", () => {
  test("action correctness is the same regardless of array order", () => {
    const original = {
      options: [
        { feedback: "F1", id: "a-critical", quality: "critical" as const, text: "Critical action" },
        { feedback: "F2", id: "a-useful", quality: "useful" as const, text: "Useful action" },
        { feedback: "F3", id: "a-weak", quality: "weak" as const, text: "Weak action" },
      ],
      variant: "action" as const,
    };

    const shuffled = { ...original, options: shuffle(original.options) };

    // Pick the weak action from the shuffled array by ID
    const resultFromShuffled = checkInvestigationAction(shuffled, "a-weak");
    const resultFromOriginal = checkInvestigationAction(original, "a-weak");

    expect(resultFromShuffled.isCorrect).toBe(false);
    expect(resultFromOriginal.isCorrect).toBe(false);
    expect(resultFromShuffled.isCorrect).toBe(resultFromOriginal.isCorrect);
  });

  test("explanation correctness is the same regardless of array order", () => {
    const original = {
      options: [
        { accuracy: "best" as const, feedback: "Correct!", id: "e-best", text: "Best" },
        { accuracy: "wrong" as const, feedback: "Wrong.", id: "e-wrong", text: "Wrong" },
      ],
      variant: "call" as const,
    };

    const shuffled = { ...original, options: shuffle(original.options) };

    const resultFromShuffled = checkInvestigationCall(shuffled, "e-best");
    const resultFromOriginal = checkInvestigationCall(original, "e-best");

    expect(resultFromShuffled.isCorrect).toBe(true);
    expect(resultFromOriginal.isCorrect).toBe(true);
    expect(resultFromShuffled.isCorrect).toBe(resultFromOriginal.isCorrect);
  });
});

describe("investigation content schema validation", () => {
  test("rejects action content with fewer than 2 actions", () => {
    expect(() =>
      parseStepContent("investigation", {
        options: [{ feedback: "F1", id: "a1", quality: "critical", text: "Action 1" }],
        variant: "action",
      }),
    ).toThrow();
  });

  test("accepts action content with exactly 2 actions", () => {
    const result = parseStepContent("investigation", {
      options: [
        { feedback: "F1", id: "a1", quality: "critical", text: "Action 1" },
        { feedback: "F2", id: "a2", quality: "useful", text: "Action 2" },
      ],
      variant: "action",
    });

    expect(result.variant).toBe("action");

    if (result.variant === "action") {
      expect(result.options).toHaveLength(2);
    }
  });
});
