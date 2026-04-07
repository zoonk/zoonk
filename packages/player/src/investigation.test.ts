import { describe, expect, test } from "vitest";
import {
  type InvestigationScoreInput,
  computeActivityScore,
  getInvestigationScoreDimensions,
} from "./compute-score";
import {
  buildJourneyData,
  extractInvestigationScoreInput,
  getAvailableActions,
  getInvestigationHunchText,
  getInvestigationStepByVariant,
  isInvestigationScoreVariant,
} from "./investigation";
import { type PlayerState } from "./player-reducer";
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

function buildState(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    activityId: "activity-1",
    completion: null,
    currentStepIndex: 0,
    investigationLoop: null,
    phase: "playing",
    results: {},
    selectedAnswers: {},
    startedAt: 1000,
    stepStartedAt: 1000,
    stepTimings: {},
    steps: [buildStep()],
    totalBrainPower: 0,
    ...overrides,
  };
}

const problemContent = {
  explanations: [
    { accuracy: "best" as const, text: "Memory leak" },
    { accuracy: "partial" as const, text: "DB pool exhausted" },
    { accuracy: "wrong" as const, text: "Network failure" },
  ],
  scenario: "API errors",
  variant: "problem" as const,
  visual: { columns: ["A"], kind: "table" as const, rows: [["1"]] },
};

const actionContent = {
  actions: [
    { label: "Check logs", quality: "critical" as const },
    { label: "Ask witness", quality: "useful" as const },
  ],
  variant: "action" as const,
};

const evidenceContent = {
  findings: [
    {
      interpretations: [
        {
          best: { feedback: "Good read", text: "Pattern consistent" },
          dismissive: { feedback: "Dismissed", text: "Not relevant" },
          overclaims: { feedback: "Overclaimed", text: "Proves it" },
        },
      ],
      text: "Finding 0",
      visual: { columns: ["A"], kind: "table" as const, rows: [["1"]] },
    },
  ],
  variant: "evidence" as const,
};

const callContent = {
  explanations: problemContent.explanations,
  fullExplanation: "The API had a memory leak",
  variant: "call" as const,
};

function buildInvestigationSteps(): SerializedStep[] {
  return [
    buildStep({ content: problemContent, id: "problem-step", kind: "investigation", position: 0 }),
    buildStep({ content: actionContent, id: "action-step", kind: "investigation", position: 1 }),
    buildStep({
      content: evidenceContent,
      id: "evidence-step",
      kind: "investigation",
      position: 2,
    }),
    buildStep({ content: callContent, id: "call-step", kind: "investigation", position: 3 }),
    buildStep({
      content: { variant: "investigationScore" as const },
      id: "score-step",
      kind: "static",
      position: 4,
    }),
  ];
}

describe("computeActivityScore (investigation)", () => {
  test("perfect score: 2 critical actions, 3 correct interpretations, best call", () => {
    const input: InvestigationScoreInput = {
      actionQualities: ["critical", "critical"],
      callAccuracy: "best",
      interpretationResults: [{ isCorrect: true }, { isCorrect: true }, { isCorrect: true }],
    };

    const result = computeActivityScore({ investigation: input, kind: "investigation" });
    expect(result.brainPower).toBe(100);
    expect(result.correctCount).toBe(4);
    expect(result.incorrectCount).toBe(0);
  });

  test("minimum score: 1 weak action, 1 wrong interpretation, wrong call", () => {
    const input: InvestigationScoreInput = {
      actionQualities: ["weak"],
      callAccuracy: "wrong",
      interpretationResults: [{ isCorrect: false }],
    };

    const result = computeActivityScore({ investigation: input, kind: "investigation" });
    expect(result.brainPower).toBe(100);
    expect(result.correctCount).toBe(0);
    expect(result.incorrectCount).toBe(2);
  });

  test("investigation score capped at 30 even with 3 critical actions", () => {
    const input: InvestigationScoreInput = {
      actionQualities: ["critical", "critical", "critical"],
      callAccuracy: "best",
      interpretationResults: [{ isCorrect: true }, { isCorrect: true }, { isCorrect: true }],
    };

    const result = computeActivityScore({ investigation: input, kind: "investigation" });
    expect(result.correctCount).toBe(4);
  });

  test("partial call accuracy gives partial credit", () => {
    const input: InvestigationScoreInput = {
      actionQualities: ["critical"],
      callAccuracy: "partial",
      interpretationResults: [{ isCorrect: true }],
    };

    const result = computeActivityScore({ investigation: input, kind: "investigation" });
    expect(result.correctCount).toBe(1);
    expect(result.incorrectCount).toBe(1);
  });

  test("mixed action qualities are summed correctly", () => {
    const input: InvestigationScoreInput = {
      actionQualities: ["critical", "useful", "weak"],
      callAccuracy: "best",
      interpretationResults: [{ isCorrect: true }, { isCorrect: false }, { isCorrect: true }],
    };

    const result = computeActivityScore({ investigation: input, kind: "investigation" });
    expect(result.correctCount).toBe(3);
    expect(result.incorrectCount).toBe(1);
  });
});

describe(getInvestigationScoreDimensions, () => {
  test("investigation score capped at 30 for two critical actions", () => {
    const input: InvestigationScoreInput = {
      actionQualities: ["critical", "critical"],
      callAccuracy: "best",
      interpretationResults: [{ isCorrect: true }],
    };

    const dimensions = getInvestigationScoreDimensions(input);
    expect(dimensions.investigationScore).toBe(30);
  });

  test("single critical action scores 15", () => {
    const input: InvestigationScoreInput = {
      actionQualities: ["critical"],
      callAccuracy: "best",
      interpretationResults: [{ isCorrect: true }],
    };

    const dimensions = getInvestigationScoreDimensions(input);
    expect(dimensions.investigationScore).toBe(15);
  });

  test("analysis score is 30 for three correct interpretations", () => {
    const input: InvestigationScoreInput = {
      actionQualities: ["critical"],
      callAccuracy: "best",
      interpretationResults: [{ isCorrect: true }, { isCorrect: true }, { isCorrect: true }],
    };

    const dimensions = getInvestigationScoreDimensions(input);
    expect(dimensions.analysisScore).toBe(30);
  });

  test("call score is 40 for best accuracy", () => {
    const input: InvestigationScoreInput = {
      actionQualities: ["critical"],
      callAccuracy: "best",
      interpretationResults: [{ isCorrect: true }],
    };

    const dimensions = getInvestigationScoreDimensions(input);
    expect(dimensions.callScore).toBe(40);
  });

  test("call score is 0 for wrong accuracy", () => {
    const input: InvestigationScoreInput = {
      actionQualities: ["weak"],
      callAccuracy: "wrong",
      interpretationResults: [{ isCorrect: false }],
    };

    const dimensions = getInvestigationScoreDimensions(input);
    expect(dimensions.callScore).toBe(0);
  });

  test("call score is 20 for partial accuracy", () => {
    const input: InvestigationScoreInput = {
      actionQualities: ["useful"],
      callAccuracy: "partial",
      interpretationResults: [{ isCorrect: true }],
    };

    const dimensions = getInvestigationScoreDimensions(input);
    expect(dimensions.callScore).toBe(20);
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

describe(buildJourneyData, () => {
  test("correct call with mind changed returns changedCorrect outcome", () => {
    const data = buildJourneyData({
      actionLabels: ["Check logs", "Ask witness"],
      hunchText: "Network failure",
      isCallCorrect: true,
      mindChanged: true,
    });

    expect(data.hunchText).toBe("Network failure");
    expect(data.actionLabels).toEqual(["Check logs", "Ask witness"]);
    expect(data.outcome).toBe("changedCorrect");
  });

  test("correct call with same hunch returns stayedCorrect outcome", () => {
    const data = buildJourneyData({
      actionLabels: ["Check logs"],
      hunchText: "Server crash",
      isCallCorrect: true,
      mindChanged: false,
    });

    expect(data.outcome).toBe("stayedCorrect");
  });

  test("incorrect call with same hunch returns stayedIncorrect outcome", () => {
    const data = buildJourneyData({
      actionLabels: ["Check logs"],
      hunchText: "Network failure",
      isCallCorrect: false,
      mindChanged: false,
    });

    expect(data.outcome).toBe("stayedIncorrect");
  });

  test("incorrect call with mind changed returns changedIncorrect outcome", () => {
    const data = buildJourneyData({
      actionLabels: ["Check logs"],
      hunchText: "Server crash",
      isCallCorrect: false,
      mindChanged: true,
    });

    expect(data.outcome).toBe("changedIncorrect");
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

describe(isInvestigationScoreVariant, () => {
  test("returns true for static step with investigationScore variant", () => {
    const step = buildStep({
      content: { variant: "investigationScore" as const },
      kind: "static",
    });
    expect(isInvestigationScoreVariant(step)).toBe(true);
  });

  test("returns false for regular static step", () => {
    const step = buildStep({ kind: "static" });
    expect(isInvestigationScoreVariant(step)).toBe(false);
  });

  test("returns false for investigation step", () => {
    const step = buildStep({ content: problemContent, kind: "investigation" });
    expect(isInvestigationScoreVariant(step)).toBe(false);
  });

  test("returns false for undefined", () => {
    expect(isInvestigationScoreVariant()).toBe(false);
  });
});

describe(getInvestigationHunchText, () => {
  test("returns null on problem step (hunch not yet chosen)", () => {
    const steps = buildInvestigationSteps();
    const state = buildState({ currentStepIndex: 0, steps });
    expect(getInvestigationHunchText(state)).toBeNull();
  });

  test("returns hunch text on action step", () => {
    const steps = buildInvestigationSteps();
    const state = buildState({
      currentStepIndex: 1,
      investigationLoop: { experimentResults: [], hunchIndex: 0, usedActionIndices: [] },
      steps,
    });
    expect(getInvestigationHunchText(state)).toBe("Memory leak");
  });

  test("returns hunch text on evidence step", () => {
    const steps = buildInvestigationSteps();
    const state = buildState({
      currentStepIndex: 2,
      investigationLoop: { experimentResults: [], hunchIndex: 1, usedActionIndices: [0] },
      steps,
    });
    expect(getInvestigationHunchText(state)).toBe("DB pool exhausted");
  });

  test("returns null on call step (spec says hidden)", () => {
    const steps = buildInvestigationSteps();
    const state = buildState({
      currentStepIndex: 3,
      investigationLoop: { experimentResults: [], hunchIndex: 0, usedActionIndices: [0] },
      steps,
    });
    expect(getInvestigationHunchText(state)).toBeNull();
  });

  test("returns null on score step (static kind, not investigation)", () => {
    const steps = buildInvestigationSteps();
    const state = buildState({ currentStepIndex: 4, steps });
    expect(getInvestigationHunchText(state)).toBeNull();
  });

  test("returns null when investigationLoop is null", () => {
    const steps = buildInvestigationSteps();
    const state = buildState({ currentStepIndex: 1, investigationLoop: null, steps });
    expect(getInvestigationHunchText(state)).toBeNull();
  });
});

describe(extractInvestigationScoreInput, () => {
  test("returns null when investigationLoop is null", () => {
    const state = buildState({ investigationLoop: null });
    expect(extractInvestigationScoreInput(state)).toBeNull();
  });

  test("extracts scoring input from a completed investigation", () => {
    const steps = buildInvestigationSteps();
    const state = buildState({
      investigationLoop: {
        experimentResults: [{ actionIndex: 0, isCorrect: true }],
        hunchIndex: 0,
        usedActionIndices: [0],
      },
      selectedAnswers: {
        "call-step": {
          kind: "investigation",
          selectedExplanationIndex: 0,
          variant: "call",
        },
      },
      steps,
    });

    const input = extractInvestigationScoreInput(state);
    expect(input).not.toBeNull();
    expect(input?.actionQualities).toEqual(["critical"]);
    expect(input?.interpretationResults).toEqual([{ isCorrect: true }]);
    expect(input?.callAccuracy).toBe("best");
  });

  test("returns null when call answer is missing", () => {
    const steps = buildInvestigationSteps();
    const state = buildState({
      investigationLoop: {
        experimentResults: [{ actionIndex: 0, isCorrect: true }],
        hunchIndex: 0,
        usedActionIndices: [0],
      },
      selectedAnswers: {},
      steps,
    });

    expect(extractInvestigationScoreInput(state)).toBeNull();
  });
});
