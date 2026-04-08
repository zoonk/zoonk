import { describe, expect, test } from "vitest";
import { buildScoringInput, computeActivityScore } from "./compute-score";

describe("computeActivityScore (generic)", () => {
  test("all correct (5): BP=10, energyDelta=1.0", () => {
    const result = computeActivityScore({
      kind: "generic",
      results: [
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: true },
      ],
    });

    expect(result).toEqual({
      brainPower: 10,
      correctCount: 5,
      energyDelta: 1,
      incorrectCount: 0,
    });
  });

  test("all incorrect (5): BP=10, energyDelta=-0.5", () => {
    const result = computeActivityScore({
      kind: "generic",
      results: [
        { isCorrect: false },
        { isCorrect: false },
        { isCorrect: false },
        { isCorrect: false },
        { isCorrect: false },
      ],
    });

    expect(result).toEqual({
      brainPower: 10,
      correctCount: 0,
      energyDelta: -0.5,
      incorrectCount: 5,
    });
  });

  test("mix (3 correct, 2 incorrect): BP=10, energyDelta=0.4", () => {
    const result = computeActivityScore({
      kind: "generic",
      results: [
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: false },
        { isCorrect: false },
      ],
    });

    expect(result).toEqual({
      brainPower: 10,
      correctCount: 3,
      energyDelta: 0.4,
      incorrectCount: 2,
    });
  });

  test("empty results (static activity): BP=10, energyDelta=0.1", () => {
    const result = computeActivityScore({ kind: "generic", results: [] });

    expect(result).toEqual({
      brainPower: 10,
      correctCount: 0,
      energyDelta: 0.1,
      incorrectCount: 0,
    });
  });
});

describe("computeActivityScore (story)", () => {
  test("all strong: BP=100, energy=15, 5 correct", () => {
    const result = computeActivityScore({
      alignments: ["strong", "strong", "strong", "strong", "strong"],
      kind: "story",
    });

    expect(result).toEqual({
      brainPower: 100,
      correctCount: 5,
      energyDelta: 15,
      incorrectCount: 0,
    });
  });

  test("all weak: BP=100, energy=0, 0 correct", () => {
    const result = computeActivityScore({
      alignments: ["weak", "weak", "weak", "weak", "weak"],
      kind: "story",
    });

    expect(result).toEqual({
      brainPower: 100,
      correctCount: 0,
      energyDelta: 0,
      incorrectCount: 5,
    });
  });

  test("all partial: BP=100, energy=5, 5 correct", () => {
    const result = computeActivityScore({
      alignments: ["partial", "partial", "partial", "partial", "partial"],
      kind: "story",
    });

    expect(result).toEqual({
      brainPower: 100,
      correctCount: 5,
      energyDelta: 5,
      incorrectCount: 0,
    });
  });

  test("mixed alignments: energy sums per choice", () => {
    const result = computeActivityScore({
      alignments: ["strong", "weak", "partial", "strong", "weak"],
      kind: "story",
    });

    expect(result).toEqual({
      brainPower: 100,
      correctCount: 3,
      energyDelta: 7,
      incorrectCount: 2,
    });
  });

  test("empty alignments: BP=100, energy=0", () => {
    const result = computeActivityScore({ alignments: [], kind: "story" });

    expect(result).toEqual({
      brainPower: 100,
      correctCount: 0,
      energyDelta: 0,
      incorrectCount: 0,
    });
  });
});

describe(computeActivityScore, () => {
  test("dispatches generic kind to computeScore", () => {
    const result = computeActivityScore({
      kind: "generic",
      results: [{ isCorrect: true }, { isCorrect: false }],
    });

    expect(result.brainPower).toBe(10);
    expect(result.correctCount).toBe(1);
  });

  test("dispatches story kind to computeStoryScore", () => {
    const result = computeActivityScore({
      alignments: ["strong", "partial"],
      kind: "story",
    });

    expect(result.brainPower).toBe(100);
    expect(result.energyDelta).toBe(4);
  });

  test("dispatches investigation kind to computeInvestigationScore", () => {
    const result = computeActivityScore({
      investigation: {
        actionQualities: ["critical"],
        callAccuracy: "best",
      },
      kind: "investigation",
    });

    expect(result.brainPower).toBe(100);
  });
});

describe("computeActivityScore (investigation)", () => {
  test("perfect run: 2 critical actions + best call = 3/3 correct, +10 energy", () => {
    const result = computeActivityScore({
      investigation: {
        actionQualities: ["critical", "critical"],
        callAccuracy: "best",
      },
      kind: "investigation",
    });

    expect(result).toEqual({
      brainPower: 100,
      correctCount: 3,
      energyDelta: 10,
      incorrectCount: 0,
    });
  });

  test("mediocre run: 2 useful actions + partial call = 2/3 correct, +5 energy", () => {
    const result = computeActivityScore({
      investigation: {
        actionQualities: ["useful", "useful"],
        callAccuracy: "partial",
      },
      kind: "investigation",
    });

    expect(result).toEqual({
      brainPower: 100,
      correctCount: 2,
      energyDelta: 5,
      incorrectCount: 1,
    });
  });

  test("worst run: 2 weak actions + wrong call = 0/3 correct, 0 energy", () => {
    const result = computeActivityScore({
      investigation: {
        actionQualities: ["weak", "weak"],
        callAccuracy: "wrong",
      },
      kind: "investigation",
    });

    expect(result).toEqual({
      brainPower: 100,
      correctCount: 0,
      energyDelta: 0,
      incorrectCount: 3,
    });
  });

  test("mixed actions: critical + useful + best call = 3/3 correct, +9 energy", () => {
    const result = computeActivityScore({
      investigation: {
        actionQualities: ["critical", "useful"],
        callAccuracy: "best",
      },
      kind: "investigation",
    });

    expect(result).toEqual({
      brainPower: 100,
      correctCount: 3,
      energyDelta: 9,
      incorrectCount: 0,
    });
  });

  test("mixed actions + wrong call: critical + weak + wrong = 1/3 correct", () => {
    const result = computeActivityScore({
      investigation: {
        actionQualities: ["critical", "weak"],
        callAccuracy: "wrong",
      },
      kind: "investigation",
    });

    expect(result).toEqual({
      brainPower: 100,
      correctCount: 1,
      energyDelta: 2,
      incorrectCount: 2,
    });
  });

  test("single action: 1 critical + partial call = 1/2 correct, +5 energy", () => {
    const result = computeActivityScore({
      investigation: {
        actionQualities: ["critical"],
        callAccuracy: "partial",
      },
      kind: "investigation",
    });

    expect(result).toEqual({
      brainPower: 100,
      correctCount: 1,
      energyDelta: 5,
      incorrectCount: 1,
    });
  });

  test("empty actions + best call = 1/1 correct, +6 energy (call only)", () => {
    const result = computeActivityScore({
      investigation: {
        actionQualities: [],
        callAccuracy: "best",
      },
      kind: "investigation",
    });

    expect(result).toEqual({
      brainPower: 100,
      correctCount: 1,
      energyDelta: 6,
      incorrectCount: 0,
    });
  });
});

describe(buildScoringInput, () => {
  test("returns generic input for standard activity kinds", () => {
    const result = buildScoringInput({
      activityKind: "quiz",
      answers: {},
      stepResults: [{ isCorrect: true }, { isCorrect: false }],
      steps: [],
    });

    expect(result.kind).toBe("generic");
  });

  test("returns story input when activity has story steps and answers", () => {
    const result = buildScoringInput({
      activityKind: "story",
      answers: {
        "1": { kind: "story", selectedChoiceId: "c1", selectedText: "Strong choice" },
      },
      stepResults: [],
      steps: [
        {
          content: {
            choices: [
              {
                alignment: "strong",
                consequence: "Good",
                id: "c1",
                metricEffects: [],
                text: "Strong choice",
              },
              {
                alignment: "weak",
                consequence: "Bad",
                id: "c2",
                metricEffects: [],
                text: "Weak choice",
              },
            ],
            situation: "Scenario",
          },
          id: "1",
          kind: "story",
        },
      ],
    });

    expect(result.kind).toBe("story");

    if (result.kind === "story") {
      expect(result.alignments).toEqual(["strong"]);
    }
  });

  test("returns investigation input when activity has investigation steps and loop", () => {
    const result = buildScoringInput({
      activityKind: "investigation",
      answers: {
        "call-1": { kind: "investigation", selectedExplanationId: "e1", variant: "call" },
      },
      investigationLoop: {
        actionTimings: [],
        usedActionIds: ["a1"],
      },
      stepResults: [],
      steps: [
        {
          content: {
            actions: [
              {
                finding: "Logs show memory climbing",
                id: "a1",
                label: "Check logs",
                quality: "critical",
              },
              { finding: "Filler", id: "a2", label: "Filler 1", quality: "useful" },
              { finding: "Filler", id: "a3", label: "Filler 2", quality: "weak" },
            ],
            variant: "action",
          },
          id: "action-1",
          kind: "investigation",
        },
        {
          content: {
            explanations: [
              { accuracy: "best", feedback: "Correct!", id: "e1", text: "Memory leak" },
              { accuracy: "wrong", feedback: "Incorrect.", id: "e2", text: "Network" },
            ],
            variant: "call",
          },
          id: "call-1",
          kind: "investigation",
        },
      ],
    });

    expect(result.kind).toBe("investigation");

    if (result.kind === "investigation") {
      expect(result.investigation.actionQualities).toEqual(["critical"]);
      expect(result.investigation.callAccuracy).toBe("best");
    }
  });

  test("falls back to generic when investigation loop is missing", () => {
    const result = buildScoringInput({
      activityKind: "investigation",
      answers: {},
      stepResults: [{ isCorrect: true }],
      steps: [],
    });

    expect(result.kind).toBe("generic");
  });

  test("falls back to generic when story has no matching answers", () => {
    const result = buildScoringInput({
      activityKind: "story",
      answers: {},
      stepResults: [{ isCorrect: true }],
      steps: [
        {
          content: {
            choices: [
              {
                alignment: "strong",
                consequence: "Good",
                id: "c1",
                metricEffects: [],
                text: "Strong choice",
              },
              {
                alignment: "weak",
                consequence: "Bad",
                id: "c2",
                metricEffects: [],
                text: "Weak choice",
              },
            ],
            situation: "Scenario",
          },
          id: "1",
          kind: "story",
        },
      ],
    });

    expect(result.kind).toBe("generic");
  });
});
