import { type WritingResult } from "@zoonk/core/exams/essays/writing-contract";
import { describe, expect, it } from "vitest";
import { getNextStep } from "./next-step";

const TEXT = "Internal control is exercised by each branch. External control belongs to Congress.";

function criterion(level: WritingResult["criteria"][number]["level"], id = "a1") {
  return { comment: `Comment on ${id}`, id, level, name: `Criterion ${id}`, quote: null };
}

function levels(
  overrides: Partial<Extract<WritingResult, { kind: "levels" }>> = {},
): WritingResult {
  return {
    criteria: [criterion("complete")],
    errors: [],
    ignoredFrom: null,
    kind: "levels",
    nextStep: null,
    progress: null,
    ...overrides,
  };
}

function points(
  overrides: Partial<Extract<WritingResult, { kind: "points" }>> = {},
): WritingResult {
  return {
    content: { high: 10, low: 10 },
    criteria: [criterion("strong")],
    deduction: { high: 0, low: 0 },
    errors: [],
    ignoredFrom: null,
    kind: "points",
    max: 10,
    nextStep: null,
    progress: null,
    rows: [{ earned: 10, id: "a1", max: 10 }],
    total: { high: 10, low: 10 },
    zeroReason: null,
    ...overrides,
  };
}

const step = {
  criterionId: "a1",
  example: null,
  quote: "Internal control is exercised by each branch.",
  text: "Explain how the two controls work together.",
};

describe(getNextStep, () => {
  it("is done only when every criterion is complete and every line is read", () => {
    expect(getNextStep({ grade: levels(), text: TEXT })).toStrictEqual({ kind: "done" });
    expect(getNextStep({ grade: points(), text: TEXT })).toStrictEqual({ kind: "done" });
  });

  it("never calls a zeroed answer done", () => {
    const grade = points({
      rows: [{ earned: 0, id: "a1", max: 10 }],
      total: { high: 0, low: 0 },
      zeroReason: "An answer off the topic gets zero.",
    });

    expect(getNextStep({ grade, text: TEXT }).kind).toBe("criterion");
  });

  it("asks to fit the limit when text runs past it and nothing else needs fixing", () => {
    expect(
      getNextStep({ grade: levels({ ignoredFrom: 20, nextStep: step }), text: TEXT }),
    ).toStrictEqual({ kind: "limit" });
  });

  it("follows the grader's limit step", () => {
    const grade = levels({
      criteria: [criterion("partial")],
      ignoredFrom: 20,
      nextStep: { ...step, kind: "limit" } as WritingResult["nextStep"],
    });

    expect(getNextStep({ grade, text: TEXT })).toStrictEqual({ kind: "limit" });
  });

  it("names the change itself, falling back to the criterion for older answers", () => {
    const titled = { ...step, title: "Say how they work together" } as WritingResult["nextStep"];
    const graded = levels({ criteria: [criterion("partial")], nextStep: titled });
    const older = levels({ criteria: [criterion("partial")], nextStep: step });

    expect(getNextStep({ grade: graded, text: TEXT })).toMatchObject({
      title: "Say how they work together",
    });

    expect(getNextStep({ grade: older, text: TEXT })).toMatchObject({ title: "Criterion a1" });
  });

  it("drops a quote that isn't in the text", () => {
    const grade = levels({
      criteria: [criterion("partial")],
      nextStep: { ...step, quote: "A sentence the learner never wrote." },
    });

    expect(getNextStep({ grade, text: TEXT })).toMatchObject({ quote: null });
  });

  it("points to the first unfinished criterion when an older answer names no step", () => {
    const grade = levels({ criteria: [criterion("complete"), criterion("partial", "a2")] });

    expect(getNextStep({ grade, text: TEXT })).toMatchObject({
      kind: "criterion",
      text: "Comment on a2",
      title: "Criterion a2",
    });
  });
});
