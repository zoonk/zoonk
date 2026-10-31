import { describe, expect, it } from "vitest";
import { getMockFormatMix, getMockWritingFormat } from "../../exams/mocks/mock-format-mix";
import { type ExamStructure } from "./blueprint-contract";
import { listSubjectNames } from "./subject-names";

describe(getMockWritingFormat, () => {
  it("resolves Paper 1 through subjects' group and partOf without selecting Law", () => {
    const structure = {
      formats: [
        {
          citation: { passage: "", sourceId: "notice" },
          description: "",
          kind: "multipleChoice",
          options: 5,
          sections: ["Paper 1"],
        },
        {
          citation: { passage: "", sourceId: "notice" },
          description: "",
          kind: "numeric",
          options: null,
          sections: ["Paper 2"],
        },
      ],
      subjects: [
        { group: "Paper 1", name: "Mathematics" },
        { name: "Algebra", partOf: "Mathematics" },
        { group: "Paper 2", name: "Law" },
      ],
    } as ExamStructure;

    const format = getMockFormatMix(structure)[0];

    if (!format) {
      throw new Error("Expected a choice format");
    }

    const skills = [{ area: "Mathematics" }, { area: "Algebra" }, { area: "Law" }];

    expect(
      skills.filter(
        (skill) =>
          getMockWritingFormat({
            allNames: skills.flatMap((candidate) =>
              listSubjectNames({ area: candidate.area, structure }),
            ),
            format,
            names: listSubjectNames({ area: skill.area, structure }),
            structure,
          }) !== null,
      ),
    ).toStrictEqual(skills.slice(0, 2));
  });
});
