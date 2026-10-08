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
