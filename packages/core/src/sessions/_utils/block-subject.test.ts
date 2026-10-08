import { describe, expect, it } from "vitest";
import { getBlockSubject } from "./block-subject";

const skillSubjects = new Map([
  ["ortho", "Língua Portuguesa"],
  ["cohesion", "Língua Portuguesa"],
  ["principles", "Direito Constitucional"],
]);

const subjectOf = (skillIds: string[], planItemSkillId: string | null = null) =>
  getBlockSubject({ planItemSkillId, skillIds, skillSubjects });

describe(getBlockSubject, () => {
  it("is the plan item's skill's subject for a lesson, whatever finer skills the lesson teaches", () => {
    expect(subjectOf(["a-fine-skill", "another"], "principles")).toBe("Direito Constitucional");
  });

  it("is the one subject a block's skills share, ignoring skills outside the goal's graph", () => {
    expect(subjectOf(["ortho", "cohesion"])).toBe("Língua Portuguesa");
    expect(subjectOf(["principles", "a-prerequisite"])).toBe("Direito Constitucional");
    expect(subjectOf(["ortho"], "a-skill-outside")).toBe("Língua Portuguesa");
  });

  it("is null when a block mixes subjects or none of its skills has one", () => {
    expect(subjectOf(["ortho", "principles"])).toBeNull();
    expect(subjectOf(["a-prerequisite"])).toBeNull();
    expect(subjectOf([])).toBeNull();
  });
});
