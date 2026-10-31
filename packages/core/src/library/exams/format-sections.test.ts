import { describe, expect, it } from "vitest";
import { type ExamStructure } from "./blueprint-contract";
import { listAskedSkills } from "./format-sections";

describe(listAskedSkills, () => {
  it("resolves Paper 1 through subjects' group and partOf without selecting Law", () => {
    const structure = {
      subjects: [
        { group: "Paper 1", name: "Mathematics" },
        { name: "Algebra", partOf: "Mathematics" },
        { group: "Paper 2", name: "Law" },
      ],
    } as ExamStructure;

    const skills = [{ area: "Mathematics" }, { area: "Algebra" }, { area: "Law" }];

    expect(listAskedSkills({ format: { sections: ["Paper 1"] }, skills, structure })).toStrictEqual(
      skills.slice(0, 2),
    );
  });
});
