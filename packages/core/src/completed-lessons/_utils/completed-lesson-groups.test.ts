import { describe, expect, it } from "vitest";
import { groupCompletedLessons } from "./completed-lesson-groups";

const names = new Map([
  ["math-1", "Mathematics"],
  ["math-2", "Mathematics"],
  ["history", "History"],
]);

function lessonsOf(...skills: (string | null)[]) {
  return skills.map((skillId) => ({ skillIds: skillId ? [skillId] : [] }));
}

const LONG = lessonsOf(
  "history",
  "math-1",
  "math-2",
  "math-1",
  null,
  "history",
  "math-1",
  "math-2",
  "math-1",
  "math-2",
  "history",
);

function kindFor(input: Pick<Parameters<typeof groupCompletedLessons>[0], "goalKind" | "groups">) {
  return groupCompletedLessons({ ...input, lessons: LONG }).filter?.kind;
}

describe(groupCompletedLessons, () => {
  it("counts each group, the one with the most lessons first, and keys every lesson", () => {
    const grouped = groupCompletedLessons({
      goalKind: "exam",
      groups: { kind: "subjects", names },
      lessons: LONG,
    });

    expect(grouped.filter).toStrictEqual({
      groups: [
        { key: "mathematics", lessons: 7, name: "Mathematics" },
        { key: "history", lessons: 3, name: "History" },
      ],
      kind: "subjects",
      total: 11,
    });

    expect(grouped.keys.slice(0, 5)).toStrictEqual([
      "history",
      "mathematics",
      "mathematics",
      "mathematics",
      null,
    ]);
  });

  it("names the groups as the plan does", () => {
    expect(kindFor({ goalKind: "learn", groups: { kind: "subjects", names } })).toBe("modules");
    expect(kindFor({ goalKind: "language", groups: { kind: "phases", names } })).toBe("phases");
  });

  it("uses the group a lesson's first skill in the plan belongs to", () => {
    const lessons = [{ skillIds: ["outside-the-plan", "history", "math-1"] }, ...LONG];

    const grouped = groupCompletedLessons({
      goalKind: "exam",
      groups: { kind: "subjects", names },
      lessons,
    });

    expect(grouped.keys[0]).toBe("history");
  });

  it("offers nothing to narrow a list read at a glance, or one with a single group", () => {
    const groups = { kind: "subjects", names } as const;

    expect(
      groupCompletedLessons({ goalKind: "exam", groups, lessons: LONG.slice(0, 10) }).filter,
    ).toBeNull();

    expect(
      groupCompletedLessons({
        goalKind: "exam",
        groups,
        lessons: LONG.map(() => ({ skillIds: ["math-1"] })),
      }).filter,
    ).toBeNull();

    expect(
      groupCompletedLessons({ goalKind: "exam", groups: null, lessons: LONG }).filter,
    ).toBeNull();
  });
});
