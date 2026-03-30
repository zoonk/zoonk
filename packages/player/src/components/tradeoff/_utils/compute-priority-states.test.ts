import { type TradeoffStepContent } from "@zoonk/core/steps/content-contract";
import { describe, expect, it } from "vitest";
import { type SelectedAnswer } from "../../../player-reducer";
import { type SerializedStep } from "../../../prepare-activity-data";
import { computePriorityStates, getTradeoffRoundInfo } from "./compute-priority-states";

const PRIORITIES = [
  { description: "Study notes", id: "study", name: "Study" },
  { description: "Exercise", id: "exercise", name: "Exercise" },
  { description: "Sleep", id: "sleep", name: "Sleep" },
];

const RESOURCE = { name: "hours", total: 5 };

function makeTradeoffContent(overrides: Partial<TradeoffStepContent> = {}): TradeoffStepContent {
  return {
    event: null,
    outcomes: PRIORITIES.map((priority) => ({
      invested: { consequence: "invested" },
      maintained: { consequence: "maintained" },
      neglected: { consequence: "neglected" },
      priorityId: priority.id,
    })),
    priorities: PRIORITIES,
    resource: RESOURCE,
    stateModifiers: null,
    tokenOverride: null,
    ...overrides,
  };
}

function makeStep(id: string, content: TradeoffStepContent, position: number): SerializedStep {
  return {
    content,
    fillBlankOptions: [],
    id,
    kind: "tradeoff",
    matchColumnsRightItems: [],
    position,
    sentence: null,
    sentenceWordOptions: [],
    sortOrderItems: [],
    translationOptions: [],
    vocabularyOptions: [],
    word: null,
    wordBankOptions: [],
  };
}

function makeStaticStep(id: string, position: number): SerializedStep {
  return {
    content: { text: "intro", title: "Intro", variant: "text" as const },
    fillBlankOptions: [],
    id,
    kind: "static",
    matchColumnsRightItems: [],
    position,
    sentence: null,
    sentenceWordOptions: [],
    sortOrderItems: [],
    translationOptions: [],
    vocabularyOptions: [],
    word: null,
    wordBankOptions: [],
  };
}

describe(computePriorityStates, () => {
  it("returns initial states (1 for each priority) when no answers exist", () => {
    const round1 = makeTradeoffContent();
    const steps = [makeStep("step-1", round1, 1)];

    const result = computePriorityStates({
      allSteps: steps,
      currentStepId: "step-1",
      includeCurrentRound: false,
      selectedAnswers: {},
    });

    expect(result).toEqual({ exercise: 1, sleep: 1, study: 1 });
  });

  it("applies allocation deltas when includeCurrentRound is true", () => {
    const round1 = makeTradeoffContent();
    const steps = [makeStep("step-1", round1, 1)];

    const answers: Record<string, SelectedAnswer> = {
      "step-1": {
        allocations: [
          { priorityId: "study", tokens: 3 },
          { priorityId: "exercise", tokens: 1 },
          { priorityId: "sleep", tokens: 0 },
        ],
        kind: "tradeoff",
      },
    };

    const result = computePriorityStates({
      allSteps: steps,
      currentStepId: "step-1",
      includeCurrentRound: true,
      selectedAnswers: answers,
    });

    // study: 1 + 1 (invested) = 2
    // exercise: 1 + 0 (maintained) = 1
    // sleep: 1 - 1 (neglected) = 0
    expect(result).toEqual({ exercise: 1, sleep: 0, study: 2 });
  });

  it("accumulates states across multiple rounds", () => {
    const round1 = makeTradeoffContent();
    const round2 = makeTradeoffContent({ event: "Event happened" });
    const steps = [makeStep("step-1", round1, 1), makeStep("step-2", round2, 2)];

    const answers: Record<string, SelectedAnswer> = {
      "step-1": {
        allocations: [
          { priorityId: "study", tokens: 2 },
          { priorityId: "exercise", tokens: 2 },
          { priorityId: "sleep", tokens: 1 },
        ],
        kind: "tradeoff",
      },
      "step-2": {
        allocations: [
          { priorityId: "study", tokens: 0 },
          { priorityId: "exercise", tokens: 2 },
          { priorityId: "sleep", tokens: 2 },
        ],
        kind: "tradeoff",
      },
    };

    const result = computePriorityStates({
      allSteps: steps,
      currentStepId: "step-2",
      includeCurrentRound: true,
      selectedAnswers: answers,
    });

    // study: 1 + 1 (R1 invested) - 1 (R2 neglected) = 1
    // exercise: 1 + 1 (R1 invested) + 1 (R2 invested) = 3
    // sleep: 1 + 0 (R1 maintained) + 1 (R2 invested) = 2
    expect(result).toEqual({ exercise: 3, sleep: 2, study: 1 });
  });

  it("applies state modifiers from events", () => {
    const round1 = makeTradeoffContent();
    const round2 = makeTradeoffContent({
      event: "Stress hit",
      stateModifiers: [{ delta: -1, priorityId: "sleep" }],
    });
    const steps = [makeStep("step-1", round1, 1), makeStep("step-2", round2, 2)];

    const answers: Record<string, SelectedAnswer> = {
      "step-1": {
        allocations: [
          { priorityId: "study", tokens: 2 },
          { priorityId: "exercise", tokens: 1 },
          { priorityId: "sleep", tokens: 2 },
        ],
        kind: "tradeoff",
      },
    };

    // Before round 2 allocation — includeCurrentRound: false
    // but state modifiers for current round ARE applied
    const result = computePriorityStates({
      allSteps: steps,
      currentStepId: "step-2",
      includeCurrentRound: false,
      selectedAnswers: answers,
    });

    // study: 1 + 1 (R1 invested) = 2
    // exercise: 1 + 0 (R1 maintained) = 1
    // sleep: 1 + 1 (R1 invested) - 1 (R2 modifier) = 1
    expect(result).toEqual({ exercise: 1, sleep: 1, study: 2 });
  });

  it("ignores non-tradeoff steps when computing round info", () => {
    const round1 = makeTradeoffContent();
    const steps = [makeStaticStep("intro", 0), makeStep("step-1", round1, 1)];

    const result = computePriorityStates({
      allSteps: steps,
      currentStepId: "step-1",
      includeCurrentRound: false,
      selectedAnswers: {},
    });

    expect(result).toEqual({ exercise: 1, sleep: 1, study: 1 });
  });

  it("returns empty object for unknown step ID", () => {
    const round1 = makeTradeoffContent();
    const steps = [makeStep("step-1", round1, 1)];

    const result = computePriorityStates({
      allSteps: steps,
      currentStepId: "unknown",
      includeCurrentRound: false,
      selectedAnswers: {},
    });

    expect(result).toEqual({});
  });
});

describe(getTradeoffRoundInfo, () => {
  it("returns correct round number and total", () => {
    const content = makeTradeoffContent();
    const steps = [
      makeStaticStep("intro", 0),
      makeStep("r1", content, 1),
      makeStep("r2", content, 2),
      makeStep("r3", content, 3),
      makeStaticStep("reflection", 4),
    ];

    expect(getTradeoffRoundInfo(steps, "r1")).toEqual({
      isLastRound: false,
      roundNumber: 1,
      totalRounds: 3,
    });

    expect(getTradeoffRoundInfo(steps, "r2")).toEqual({
      isLastRound: false,
      roundNumber: 2,
      totalRounds: 3,
    });

    expect(getTradeoffRoundInfo(steps, "r3")).toEqual({
      isLastRound: true,
      roundNumber: 3,
      totalRounds: 3,
    });
  });
});
