import { describe, expect, test } from "vitest";
import { type InvestigationScoreInput, computeActivityScore } from "./compute-score";
import { getAvailableActions, getInvestigationStepByVariant } from "./investigation";
import { type SerializedStep } from "./prepare-activity-data";

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
  visual: { columns: ["A"], kind: "table" as const, rows: [["1"]] },
};

const actionContent = {
  actions: [
    {
      finding: "Logs show memory climbing",
      findingVisual: { columns: ["A"], kind: "table" as const, rows: [["1"]] },
      label: "Check logs",
      quality: "critical" as const,
    },
    {
      finding: "Witness saw restart",
      findingVisual: { columns: ["B"], kind: "table" as const, rows: [["2"]] },
      label: "Ask witness",
      quality: "useful" as const,
    },
  ],
  variant: "action" as const,
};

const callContent = {
  explanations: [
    { accuracy: "best" as const, text: "Memory leak" },
    { accuracy: "partial" as const, text: "DB pool exhausted" },
    { accuracy: "wrong" as const, text: "Network failure" },
  ],
  fullExplanation: "The API had a memory leak",
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
  test("perfect score: 3 critical actions, best call", () => {
    const input: InvestigationScoreInput = {
      actionQualities: ["critical", "critical", "critical"],
      callAccuracy: "best",
    };

    const result = computeActivityScore({ investigation: input, kind: "investigation" });
    expect(result.brainPower).toBe(100);
    expect(result.correctCount).toBe(1);
    expect(result.incorrectCount).toBe(0);
  });

  test("minimum score: 1 weak action, wrong call", () => {
    const input: InvestigationScoreInput = {
      actionQualities: ["weak"],
      callAccuracy: "wrong",
    };

    const result = computeActivityScore({ investigation: input, kind: "investigation" });
    expect(result.brainPower).toBe(100);
    expect(result.correctCount).toBe(0);
    expect(result.incorrectCount).toBe(1);
  });

  test("partial call accuracy counts as incorrect", () => {
    const input: InvestigationScoreInput = {
      actionQualities: ["critical"],
      callAccuracy: "partial",
    };

    const result = computeActivityScore({ investigation: input, kind: "investigation" });
    expect(result.correctCount).toBe(0);
    expect(result.incorrectCount).toBe(1);
  });
});

describe(getAvailableActions, () => {
  const actions = [
    { label: "Check logs", quality: "critical" as const },
    { label: "Ask witness", quality: "useful" as const },
    { label: "Read docs", quality: "weak" as const },
  ];

  test("returns all actions when none used", () => {
    const available = getAvailableActions(actions, []);
    expect(available).toHaveLength(3);
    expect(available[0]?.originalIndex).toBe(0);
    expect(available[1]?.originalIndex).toBe(1);
    expect(available[2]?.originalIndex).toBe(2);
  });

  test("filters out used action indices", () => {
    const available = getAvailableActions(actions, [0, 2]);
    expect(available).toHaveLength(1);
    expect(available[0]?.originalIndex).toBe(1);
    expect(available[0]?.label).toBe("Ask witness");
  });

  test("returns empty when all actions used", () => {
    const available = getAvailableActions(actions, [0, 1, 2]);
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

  test("returns undefined when variant not found", () => {
    const steps = [buildStep({ id: "s1", kind: "static" })];
    const step = getInvestigationStepByVariant(steps, "problem");
    expect(step).toBeUndefined();
  });
});
