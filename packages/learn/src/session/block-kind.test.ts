import { describe, expect, it } from "vitest";
import { getBlockKind, isAlreadyFixed } from "./block-kind";
import { type StudyBlock } from "./session-types";

type BlockFields = Pick<
  StudyBlock,
  "checkpoint" | "kind" | "mistakesOnly" | "patternId" | "screen"
>;

function checkpoint(mock: boolean): NonNullable<StudyBlock["checkpoint"]> {
  return {
    kind: "weekly",
    ...(mock
      ? { mock: true as const, mockIdentity: { day: null, fullLength: false } }
      : { mock: false as const }),
    passMark: 70,
    phase: null,
    rematch: false,
    timeLimitMinutes: null,
  };
}

function block(fields: Partial<BlockFields>): BlockFields {
  return {
    checkpoint: null,
    kind: "practice",
    mistakesOnly: false,
    patternId: null,
    screen: "session",
    ...fields,
  };
}

describe(getBlockKind, () => {
  it("marks each kind of block as what it is", () => {
    expect(getBlockKind(block({ kind: "learn" }))).toBe("lesson");
    expect(getBlockKind(block({ kind: "review" }))).toBe("review");
    expect(getBlockKind(block({ kind: "practice" }))).toBe("practice");
    expect(getBlockKind(block({ kind: "produce" }))).toBe("essay");
  });

  it("marks practice that only works on mistakes as the notebook's", () => {
    expect(getBlockKind(block({ kind: "practice", mistakesOnly: true }))).toBe("mistakes");
    expect(getBlockKind(block({ screen: "mistakesPractice" }))).toBe("mistakes");

    expect(getBlockKind(block({ patternId: "0195c1f0-0000-7000-8000-000000000001" }))).toBe(
      "mistakes",
    );
  });

  it("marks the week's checkpoint as a challenge, or as a mock exam on an exam goal", () => {
    expect(getBlockKind(block({ checkpoint: checkpoint(false), kind: "checkpoint" }))).toBe(
      "challenge",
    );

    expect(getBlockKind(block({ checkpoint: checkpoint(true), kind: "checkpoint" }))).toBe("mock");
  });
});

function mistakesRow(questions: number, status: StudyBlock["status"]) {
  return { questions, screen: "mistakesPractice" as const, status };
}

describe(isAlreadyFixed, () => {
  it("says a mistakes row still to open is already fixed once nothing is left to answer", () => {
    expect(isAlreadyFixed(mistakesRow(0, "pending"))).toBe(true);
    expect(isAlreadyFixed(mistakesRow(0, "active"))).toBe(true);
    expect(isAlreadyFixed(mistakesRow(2, "pending"))).toBe(false);
  });

  it("leaves a finished row and other blocks as they are", () => {
    expect(isAlreadyFixed(mistakesRow(0, "completed"))).toBe(false);
    expect(isAlreadyFixed({ questions: 0, screen: "session", status: "pending" })).toBe(false);
  });
});
