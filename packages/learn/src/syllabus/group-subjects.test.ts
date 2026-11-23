import { type SyllabusSubject } from "@zoonk/core/view-models/syllabus/contract";
import { describe, expect, it } from "vitest";
import { type SubjectGroup, groupSubjects } from "./group-subjects";

function subject(
  key: string,
  attrs: Partial<Pick<SyllabusSubject, "extra" | "group" | "source">> = {},
): SyllabusSubject {
  return {
    areas: [key],
    chapters: [],
    displayWeight: null,
    group: null,
    imageUrl: null,
    key,
    lessonsDone: 0,
    lessonsKnown: 0,
    lessonsTotal: 1,
    mastery: null,
    matrix: [],
    name: key,
    nextDate: null,
    notPlannedReason: null,
    preparation: null,
    questions: null,
    share: null,
    sharedWith: [],
    shortName: key,
    source: "notice",
    topicFrequencySource: null,
    topics: [],
    topicsKnown: null,
    topicsStudied: null,
    ...attrs,
  };
}

const keysOf = (groups: SubjectGroup[]) =>
  groups.map((group) => [group.name, group.extra, group.subjects.map((item) => item.key)]);

describe(groupSubjects, () => {
  it("keeps the notice's groups in the order it lists them, and what the exam doesn't test last", () => {
    const groups = groupSubjects(
      [
        subject("portuguese", { group: "P1" }),
        subject("law", { group: "P2" }),
        subject("strategy", { extra: true, source: "plan" }),
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

  it("lists subjects with no heading before the notice's named groups", () => {
    const groups = groupSubjects(
      [
        subject("portuguese", { group: "Day 1" }),
        subject("law", { group: "Day 2" }),
        subject("study-skills", { source: "plan" }),
        subject("strategy", { extra: true, source: "plan" }),
        subject("ethics"),
        subject("english", { group: "Day 1" }),
      ],
      { modules: false },
    );

    expect(keysOf(groups)).toStrictEqual([
      [null, false, ["study-skills", "ethics"]],
      ["Day 1", false, ["portuguese", "english"]],
      ["Day 2", false, ["law"]],
      [null, true, ["strategy"]],
    ]);
  });

  it("gives an area the notice doesn't name no heading of its own", () => {
    const groups = groupSubjects(
      [subject("math"), subject("essay", { source: "plan" }), subject("logic")],
      { modules: false },
    );

    expect(keysOf(groups)).toStrictEqual([[null, false, ["math", "essay", "logic"]]]);
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

  it("keeps what the exam doesn't test last when the exam has no notice", () => {
    const groups = groupSubjects(
      [
        subject("strategy", { extra: true, source: "plan" }),
        subject("math", { group: "Part 1", source: "plan" }),
      ],
      { modules: true },
    );

    expect(keysOf(groups)).toStrictEqual([
      [null, false, ["math"]],
      [null, true, ["strategy"]],
    ]);
  });
});
