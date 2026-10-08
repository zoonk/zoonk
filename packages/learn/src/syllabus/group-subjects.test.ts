import { type SyllabusSubject } from "@zoonk/core/view-models/syllabus/contract";
import { describe, expect, it } from "vitest";
import { type SubjectGroup, groupSubjects } from "./group-subjects";

function subject(
  key: string,
  attrs: Partial<Pick<SyllabusSubject, "group" | "source">> = {},
): SyllabusSubject {
  return {
    areas: [key],
    chapters: [],
    group: null,
    imageUrl: null,
    key,
    lessonsDone: 0,
    lessonsTotal: 1,
    matrix: [],
    name: key,
    nextDate: null,
    notPlannedReason: null,
    questions: null,
    share: null,
    shortName: key,
    source: "notice",
    topicFrequencySource: null,
    topics: [],
    topicsStudied: null,
    ...attrs,
  };
}

const keysOf = (groups: SubjectGroup[]) =>
  groups.map((group) => [group.name, group.extra, group.subjects.map((item) => item.key)]);

describe(groupSubjects, () => {
  it("keeps the notice's groups in the order it lists them, and the plan's own areas last", () => {
    const groups = groupSubjects(
      [
        subject("portuguese", { group: "P1" }),
        subject("law", { group: "P2" }),
        subject("strategy", { source: "plan" }),
        subject("english", { group: "P1" }),
      ],
      { modules: false },
    );

    expect(keysOf(groups)).toStrictEqual([
      ["P1", false, ["portuguese", "english"]],
      ["P2", false, ["law"]],
      [null, true, ["strategy"]],
    ]);
  });

  it("lists a notice without groups, and a plan's modules, as one run", () => {
    expect(
      keysOf(groupSubjects([subject("math"), subject("essay")], { modules: false })),
    ).toStrictEqual([[null, false, ["math", "essay"]]]);

    expect(
      keysOf(
        groupSubjects(
          [subject("research", { source: "plan" }), subject("figma", { source: "plan" })],
          { modules: true },
        ),
      ),
    ).toStrictEqual([[null, false, ["research", "figma"]]]);
  });
});
