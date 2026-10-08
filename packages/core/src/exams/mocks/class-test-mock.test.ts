import { describe, expect, it } from "vitest";
import { examStructureSchema } from "../../library/exams/blueprint-contract";
import { withClassTestMock } from "./class-test-mock";

/** A class test read from the learner's slides: subjects, no mock conditions of its own. */
const STRUCTURE = examStructureSchema.parse({ formats: [], mock: null, rules: [], subjects: [] });

function mockOf(dayMinutes?: number | null) {
  return withClassTestMock({ dayMinutes, ownerId: "learner", structure: STRUCTURE }).mock;
}

describe(withClassTestMock, () => {
  it("copies a short test of ten questions in half an hour", () => {
    expect(mockOf()).toMatchObject({ timeLimitMinutes: 30, totalQuestions: 10 });
    expect(mockOf(60)).toMatchObject({ timeLimitMinutes: 30, totalQuestions: 10 });
  });

  it("fits a shorter day at the same pace, never below a checkpoint's questions", () => {
    expect(mockOf(15)).toMatchObject({ timeLimitMinutes: 15, totalQuestions: 5 });
    expect(mockOf(10)).toMatchObject({ timeLimitMinutes: 10, totalQuestions: 5 });
  });

  it("keeps a public exam's own conditions", () => {
    const structure = withClassTestMock({ dayMinutes: 15, ownerId: null, structure: STRUCTURE });
    expect(structure.mock).toBeNull();
  });
});
