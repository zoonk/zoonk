import { describe, expect, it } from "vitest";
import { getBlockSubject } from "./block-subject";

const skillSubjects = new Map([
  ["ortho", "Língua Portuguesa"],
  ["cohesion", "Língua Portuguesa"],
  ["principles", "Direito Constitucional"],
]);

const subjectOf = (
  skillIds: string[],
  planItemSkillId: string | null = null,
  chapterSkillIds: string[] = [],
) => getBlockSubject({ chapterSkillIds, planItemSkillId, skillIds, skillSubjects });

describe(getBlockSubject, () => {
  it("is the plan item's skill's subject for a lesson whose own skills are finer than the graph's", () => {
    expect(subjectOf(["a-fine-skill", "another"], "principles")).toBe("Direito Constitucional");
  });

  it("is the one subject a block's own skills share, over its plan item's", () => {
    expect(subjectOf(["ortho", "cohesion"])).toBe("Língua Portuguesa");
    expect(subjectOf(["principles", "a-prerequisite"])).toBe("Direito Constitucional");
    expect(subjectOf(["ortho"], "a-skill-outside")).toBe("Língua Portuguesa");
    expect(subjectOf(["ortho", "a-fine-skill"], "principles")).toBe("Língua Portuguesa");
  });

  it("is the plan item's when the lesson's own skills mix subjects and its chapter is one subject's", () => {
    expect(subjectOf(["ortho", "principles"], "principles", ["principles"])).toBe(
      "Direito Constitucional",
    );
  });

  it("is null when the lesson's own skills don't settle it and its chapter mixes subjects", () => {
    expect(subjectOf(["a-fine-skill"], "principles", ["ortho", "principles"])).toBeNull();
    expect(subjectOf(["ortho", "principles"], "principles", ["cohesion", "principles"])).toBeNull();
  });

  it("is null when a block mixes subjects or none of its skills has one", () => {
    expect(subjectOf(["ortho", "principles"])).toBeNull();
    expect(subjectOf(["a-prerequisite"])).toBeNull();
    expect(subjectOf([])).toBeNull();
  });
});
