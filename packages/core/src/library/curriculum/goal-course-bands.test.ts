import { describe, expect, it } from "vitest";
import {
  groupGoalCourseBands,
  orderGoalCourses,
  splitGoalCourseBands,
  toGoalCourses,
} from "./goal-course-bands";
import { type GoalSkillGraph } from "./save-goal-skills";

function skill(overrides: Partial<GoalSkillGraph["skills"][number]> & { key: string }) {
  return {
    area: "Course A",
    course: "a",
    description: `Idea ${overrides.key}`,
    estimatedLessons: 2,
    examWeight: null,
    level: "beginner" as const,
    name: `Skill ${overrides.key}`,
    phase: 1,
    prerequisites: [],
    topics: [],
    ...overrides,
  };
}

const graph: GoalSkillGraph = {
  courses: [
    { key: "a", levels: ["beginner", "intermediate"], title: "Course A" },
    { key: "b", levels: ["overview"], title: "Course B" },
    { key: "c", levels: ["beginner"], title: "Course C" },
  ],
  estimatedHours: 5,
  phases: [
    { estimatedHours: 1, milestone: "One", title: "Phase one" },
    { estimatedHours: 2, milestone: "Two", title: "Phase two" },
    { estimatedHours: 2, milestone: "Three", title: "Phase three" },
  ],
  skills: [
    skill({ course: "b", key: "b1", level: "overview", phase: 1 }),
    skill({ key: "a2", level: "intermediate", phase: 3 }),
    skill({ key: "a1", phase: 2 }),
    skill({ course: "c", key: "c1", phase: 3 }),
  ],
};

const ids = { a1: "id-a1", a2: "id-a2", b1: "id-b1" };

describe(groupGoalCourseBands, () => {
  it("orders courses and their bands by the first phase that needs them", () => {
    const result = groupGoalCourseBands({ graph, idsByKey: ids });

    expect(result.map((course) => course.key)).toStrictEqual(["b", "a"]);
    expect(result[1]?.bands.map((band) => band.level)).toStrictEqual(["beginner", "intermediate"]);

    expect(result[1]?.bands[0]).toStrictEqual({
      firstPhase: 2,
      level: "beginner",
      skills: [{ description: "Idea a1", id: "id-a1", key: "a1", lessons: 2, name: "Skill a1" }],
    });
  });

  it("leaves out bands and courses whose skills the Library didn't resolve", () => {
    const result = groupGoalCourseBands({ graph, idsByKey: { a1: "id-a1" } });

    expect(result.map((course) => course.key)).toStrictEqual(["a"]);
    expect(result[0]?.bands.map((band) => band.level)).toStrictEqual(["beginner"]);
  });
});

describe(orderGoalCourses, () => {
  it("lists the graph's courses with skills in the order the learner reaches them", () => {
    expect(orderGoalCourses(graph)).toStrictEqual([
      { key: "b", title: "Course B" },
      { key: "a", title: "Course A" },
      { key: "c", title: "Course C" },
    ]);
  });
});

describe(toGoalCourses, () => {
  const needs = groupGoalCourseBands({ graph, idsByKey: ids });
  const courseIdsByKey = { a: "course-a", b: "course-b" };

  it("gives each need its Library course and keeps a shared course's bands", () => {
    const courses = toGoalCourses({ courseIdsByKey, needs, ownerId: null, withToolChapters: true });

    expect(courses.map((course) => course.courseId)).toStrictEqual(["course-b", "course-a"]);
    expect(courses[1]?.bands.map((band) => band.level)).toStrictEqual(["beginner", "intermediate"]);
  });

  it("puts every skill of a private course in one band at the level of the first one", () => {
    const [, courseA] = toGoalCourses({
      courseIdsByKey,
      needs,
      ownerId: "learner",
      withToolChapters: true,
    });

    expect(courseA?.bands).toStrictEqual([
      {
        firstPhase: 2,
        level: "beginner",
        skills: [
          { description: "Idea a1", id: "id-a1", key: "a1", lessons: 2, name: "Skill a1" },
          { description: "Idea a2", id: "id-a2", key: "a2", lessons: 2, name: "Skill a2" },
        ],
        withToolChapters: true,
      },
    ]);
  });

  it("asks every band of an exam answered without tools for chapters without tools", () => {
    const courses = toGoalCourses({
      courseIdsByKey,
      needs,
      ownerId: null,
      withToolChapters: false,
    });

    expect(
      courses.flatMap((course) => course.bands.map((band) => band.withToolChapters)),
    ).toStrictEqual([false, false, false]);
  });
});

describe(splitGoalCourseBands, () => {
  it("keeps a band near when the plan reaches any of its skills, and the rest for later", () => {
    const needs = groupGoalCourseBands({ graph, idsByKey: ids });
    const { far, near } = splitGoalCourseBands({ nearSkillIds: new Set(["id-a1"]), needs });

    expect(
      near.map((course) => [course.key, course.bands.map((band) => band.level)]),
    ).toStrictEqual([["a", ["beginner"]]]);

    expect(far.map((course) => [course.key, course.bands.map((band) => band.level)])).toStrictEqual(
      [
        ["b", ["overview"]],
        ["a", ["intermediate"]],
      ],
    );
  });

  it("leaves nothing for later when the plan reaches every band", () => {
    const needs = groupGoalCourseBands({ graph, idsByKey: ids });
    const everything = new Set(Object.values(ids));

    expect(splitGoalCourseBands({ nearSkillIds: everything, needs }).far).toStrictEqual([]);
  });
});
