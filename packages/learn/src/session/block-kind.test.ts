import { describe, expect, it } from "vitest";
import { getBlockKind } from "./block-kind";
import { type StudyBlock } from "./session-types";

type BlockFields = Pick<StudyBlock, "checkpoint" | "kind" | "mistakesOnly">;

function checkpoint(mock: boolean): NonNullable<StudyBlock["checkpoint"]> {
  return {
    kind: "weekly",
    mock,
    mockIdentity: null,
    passMark: 70,
    phase: null,
    rematch: false,
    timeLimitMinutes: null,
  };
}

function block(fields: Partial<BlockFields>): BlockFields {
  return { checkpoint: null, kind: "practice", mistakesOnly: false, ...fields };
}

describe(getBlockKind, () => {
  it("marks each kind of block as what it is", () => {
    expect(getBlockKind(block({ kind: "learn" }))).toBe("lesson");
    expect(getBlockKind(block({ kind: "review" }))).toBe("review");
    expect(getBlockKind(block({ kind: "practice" }))).toBe("practice");
    expect(getBlockKind(block({ kind: "produce" }))).toBe("essay");
  });

  it("marks practice that only fixes mistakes as the notebook's, like the mission it counts for", () => {
    expect(getBlockKind(block({ kind: "practice", mistakesOnly: true }))).toBe("mistakes");
  });

  it("marks the week's checkpoint as a challenge, or as a mock exam on an exam goal", () => {
    expect(getBlockKind(block({ checkpoint: checkpoint(false), kind: "checkpoint" }))).toBe(
      "challenge",
    );

    expect(getBlockKind(block({ checkpoint: checkpoint(true), kind: "checkpoint" }))).toBe("mock");
  });
});
