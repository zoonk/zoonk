import { describe, expect, it } from "vitest";
import { buildLessonUnits, getStandInLessons } from "./plan-units";

function lessonsOf(chapterId: string, count: number, skillIds: string[]) {
  return Array.from({ length: count }, (_, index) => ({
    chapterId,
    lessonId: `${chapterId}-${index + 1}`,
    minutes: 3,
    skillIds,
    title: `${chapterId} ${index + 1}`,
  }));
}

/** Skills of the given graph sizes, taught in `order` (their place in the graph). */
function skillsOf(sizes: Record<string, number>, order = Object.keys(sizes)) {
  return Object.entries(sizes).map(([skillId, lessons]) => ({
    area: "Biology",
    index: order.indexOf(skillId),
    lessons,
    name: skillId,
    phase: 0,
    skillId,
  }));
}

/** Each planned lesson and the skill it counts for, in the plan's order. */
function plannedLessons(input: Omit<Parameters<typeof buildLessonUnits>[0], "paceFactor">) {
  return buildLessonUnits({ ...input, paceFactor: 1 })
    .filter((unit) => unit.lessonId)
    .map((unit) => [unit.lessonId, unit.skillId]);
}

describe(buildLessonUnits, () => {
  it("keeps a foundation before every dependent when exam priority changes their order", () => {
    const lessons = [
      { ...lessonsOf("first", 1, ["shared"])[0]!, courseOrder: { phase: 0, position: 0 } },
      { ...lessonsOf("second", 1, ["dependent"])[0]!, courseOrder: { phase: 0, position: 1 } },
      { ...lessonsOf("third", 1, ["shared"])[0]!, courseOrder: { phase: 0, position: 2 } },
      { ...lessonsOf("fourth", 1, ["ranked"])[0]!, courseOrder: { phase: 0, position: 3 } },
      ...lessonsOf("foundation", 1, ["foundation"]),
    ];

    const units = buildLessonUnits({
      lessons,
      paceFactor: 1,
      prerequisites: new Map([
        ["dependent", ["foundation"]],
        ["ranked", ["foundation"]],
      ]),
      preserveCourseOrder: true,
      skills: [
        ...skillsOf({ shared: 2 }),
        ...skillsOf({ foundation: 1 }),
        ...skillsOf({ ranked: 1 }),
        ...skillsOf({ dependent: 1 }),
      ],
    });

    expect(units.map((unit) => unit.lessonId)).toStrictEqual([
      "first-1",
      "foundation-1",
      "second-1",
      "third-1",
      "fourth-1",
    ]);
  });

  it("keeps an added foundation before its dependent course lesson", () => {
    const lessons = [
      { ...lessonsOf("first", 1, ["shared"])[0]!, courseOrder: { phase: 0, position: 0 } },
      { ...lessonsOf("second", 1, ["dependent"])[0]!, courseOrder: { phase: 0, position: 1 } },
      { ...lessonsOf("third", 1, ["shared"])[0]!, courseOrder: { phase: 0, position: 2 } },
      ...lessonsOf("foundation", 1, ["foundation"]),
    ];

    const skills = [
      ...skillsOf({ shared: 2 }),
      ...skillsOf({ foundation: 1 }),
      ...skillsOf({ dependent: 1 }),
    ];

    const units = buildLessonUnits({
      lessons,
      paceFactor: 1,
      prerequisites: new Map([["dependent", ["foundation"]]]),
      preserveCourseOrder: true,
      skills,
    });

    expect(units.map((unit) => unit.lessonId)).toStrictEqual([
      "first-1",
      "foundation-1",
      "second-1",
      "third-1",
    ]);
  });

  it("keeps course levels grouped around a quick lesson without changing skill credit", () => {
    const skills = skillsOf({ quick: 1, shared: 2 });

    const lessons = [
      { ...lessonsOf("opening", 1, ["shared"])[0]!, courseOrder: { phase: 0, position: 0 } },
      { ...lessonsOf("later", 1, ["shared"])[0]!, courseOrder: { phase: 1, position: 1 } },
      ...lessonsOf("quick", 1, ["quick"]),
    ];

    const units = buildLessonUnits({ lessons, paceFactor: 1, preserveCourseOrder: true, skills });

    expect(units.map((unit) => [unit.lessonId, unit.phase, unit.skillId])).toStrictEqual([
      ["quick-1", 0, "quick"],
      ["opening-1", 0, "shared"],
      ["later-1", 1, "shared"],
    ]);
  });

  it("splits a chapter shared by several skills into runs, in teaching order, and keeps it whole", () => {
    expect(
      plannedLessons({
        lessons: lessonsOf("cells", 6, ["organelles", "theory", "types"]),
        // The graph teaches the theory first, whatever order the plan ranks them in.
        skills: skillsOf({ organelles: 2, theory: 1, types: 3 }, ["theory", "organelles", "types"]),
      }),
    ).toStrictEqual([
      ["cells-1", "theory"],
      ["cells-2", "organelles"],
      ["cells-3", "organelles"],
      ["cells-4", "types"],
      ["cells-5", "types"],
      ["cells-6", "types"],
    ]);
  });

  it("sizes each run by what the skill still needs beyond the lessons that are its alone", () => {
    expect(
      plannedLessons({
        lessons: [
          ...lessonsOf("theory", 3, ["theory"]),
          ...lessonsOf("cells", 4, ["theory", "types"]),
        ],
        skills: skillsOf({ theory: 4, types: 3 }),
      }).map(([, skillId]) => skillId),
    ).toStrictEqual(["theory", "theory", "theory", "theory", "types", "types", "types"]);
  });

  it("gives every skill a lesson when the chapter has enough, and leaves untaught lessons out", () => {
    expect(
      plannedLessons({
        lessons: [
          ...lessonsOf("cells", 3, ["theory", "organelles", "types"]),
          ...lessonsOf("other", 1, ["unplanned"]),
        ],
        skills: skillsOf({ organelles: 1, theory: 20, types: 1 }, [
          "theory",
          "organelles",
          "types",
        ]),
      }),
    ).toStrictEqual([
      ["cells-1", "theory"],
      ["cells-2", "organelles"],
      ["cells-3", "types"],
    ]);
  });

  it("plans a shared chapter's lesson at its own skill's place when that skill builds on one taught after the chapter", () => {
    // Wireframes build on content structure, which a "less" sent after the flows chapter the two
    // share: the wireframe lessons of that chapter wait for it instead of coming first.
    expect(
      plannedLessons({
        lessons: [
          ...lessonsOf("flows", 4, ["flows", "wireframes"]),
          ...lessonsOf("structure", 1, ["structure"]),
        ],
        prerequisites: new Map([["wireframes", ["flows", "structure"]]]),
        skills: skillsOf({ flows: 2, structure: 1, wireframes: 2 }, [
          "flows",
          "structure",
          "wireframes",
        ]),
      }),
    ).toStrictEqual([
      ["flows-1", "flows"],
      ["flows-2", "flows"],
      ["structure-1", "structure"],
      ["flows-3", "wireframes"],
      ["flows-4", "wireframes"],
    ]);
  });

  it("counts a lesson a chapter shares among several skills once, so each keeps a stand-in for the rest", () => {
    // A unit's first chapter of five lessons tagged with five situations of eight lessons each:
    // one lesson of each, not five of each.
    const sizes = { closing: 8, greeting: 8, motivation: 8, questions: 8, story: 8 };
    const lessons = lessonsOf("opening", 5, Object.keys(sizes));
    const skills = skillsOf(sizes);

    const standIns = buildLessonUnits({ lessons, paceFactor: 1, skills })
      .filter((unit) => !unit.lessonId)
      .map((unit) => [unit.skillId, unit.lessons]);

    expect(standIns).toStrictEqual(Object.keys(sizes).map((skillId) => [skillId, 7]));

    expect(getStandInLessons({ lessons, skills })).toStrictEqual(
      new Map(Object.keys(sizes).map((skillId) => [skillId, 7])),
    );
  });
});
