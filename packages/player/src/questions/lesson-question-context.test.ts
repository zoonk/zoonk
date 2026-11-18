import { describe, expect, it } from "vitest";
import { isSameTopic } from "./lesson-question-context";

const STEP = "6f1c1f7e-8d8a-4e55-9b49-2c1f1a7f0a01";
const OTHER_STEP = "6f1c1f7e-8d8a-4e55-9b49-2c1f1a7f0a02";

describe(isSameTopic, () => {
  it("keeps a question about the same part on the same topic", () => {
    expect(
      isSameTopic(
        { kind: "step", stepId: STEP, stepNumber: 2 },
        { kind: "step", step: { id: STEP }, stepIndex: 1 },
      ),
    ).toBe(true);
  });

  it("starts a new topic on another part of the lesson", () => {
    expect(
      isSameTopic(
        { kind: "step", stepId: STEP, stepNumber: 2 },
        { kind: "step", stepId: OTHER_STEP, stepNumber: 3 },
      ),
    ).toBe(false);
  });

  it("starts a new topic once a question is about the checked answer", () => {
    expect(isSameTopic({ answered: false, kind: "item" }, { answered: true, kind: "item" })).toBe(
      false,
    );
  });

  it("keeps two questions about the plan on one topic", () => {
    expect(isSameTopic({ kind: "plan" }, { kind: "plan" })).toBe(true);
  });

  it("tells apart questions about two parts the lesson no longer has", () => {
    expect(
      isSameTopic(
        { kind: "step", stepId: null, stepNumber: 2 },
        { kind: "step", stepId: null, stepNumber: 5 },
      ),
    ).toBe(false);
  });

  it("starts the thread with a topic", () => {
    expect(isSameTopic(null, { kind: "lesson" })).toBe(false);
  });
});
