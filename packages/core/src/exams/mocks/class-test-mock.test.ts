import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { withClassTestMock } from "./class-test-mock";
import { outlineMock } from "./mock-plan";

const SLIDES_STRUCTURE: ExamStructure = { formats: [], mock: null, rules: [], subjects: [] };

describe(withClassTestMock, () => {
  it("makes a class test's mock short, from the learner's own material", () => {
    const structure = withClassTestMock({ ownerId: "learner", structure: SLIDES_STRUCTURE });

    expect(outlineMock({ fullLength: true, structure })).toMatchObject({ minutes: 30 });
    expect(outlineMock({ fullLength: false, structure }).sections[0]?.questions).toBe(5);
  });

  it("keeps a shared exam's structure and conditions a notice gave", () => {
    const withConditions = withClassTestMock({
      ownerId: "learner",
      structure: {
        ...SLIDES_STRUCTURE,
        mock: {
          adaptive: false,
          citations: [],
          order: null,
          scoring: { description: "", method: "raw" },
          sections: [],
          timeLimitMinutes: 90,
          totalQuestions: 20,
        },
      },
    });

    expect(withClassTestMock({ ownerId: null, structure: SLIDES_STRUCTURE }).mock).toBeNull();
    expect(withConditions.mock?.totalQuestions).toBe(20);
  });
});
