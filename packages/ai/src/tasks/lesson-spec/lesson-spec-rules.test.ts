import { describe, expect, it } from "vitest";
import { type CourseLevel } from "../curriculum/_utils/course-levels";
import {
  type LessonScreen,
  type LessonScreenKind,
  type LessonSpec,
  type LessonSpecSkill,
  estimateLessonMinutes,
  fitsLesson,
  getLessonSpecIssues,
} from "./lesson-spec-rules";

function skill(name: string, hard = false): LessonSpecSkill {
  return { description: `${name}.`, example: "e", hard, name, topic: name, useCase: "u" };
}

function screen(kind: LessonScreenKind, skills: number[] = [0], extra: Partial<LessonScreen> = {}) {
  return { activityTemplate: null, brief: kind, kind, skills, visual: null, ...extra };
}

function spec(screens: LessonScreen[], skills = [skill("Calculate a percent change")]): LessonSpec {
  return {
    canDo: "Calculate a percent change",
    description: "d",
    estimatedMinutes: estimateLessonMinutes(screens.map((item) => item.kind)),
    screens,
    skills,
    supportMode: "explanationFirst",
    title: "Percent change",
  };
}

const validScreens = [
  screen("hook", []),
  screen("explanation"),
  screen("explanation"),
  screen("check"),
  screen("explanation"),
  screen("check"),
  screen("application"),
];

const illustratedScreens = validScreens.map((item, index) =>
  index === 0 || index === 1 ? { ...item, visual: `Picture ${index}` } : item,
);

function getCodes(
  lesson: LessonSpec,
  level: CourseLevel = "beginner",
  novice = false,
  visualFloor = novice,
) {
  return getLessonSpecIssues({ level, novice, spec: lesson, visualFloor }).map(
    (issue) => issue.code,
  );
}

describe(estimateLessonMinutes, () => {
  it("estimates minutes from the kinds of screens and never goes below two", () => {
    expect(estimateLessonMinutes(["hook", "explanation", "check", "application"])).toBe(2);

    expect(
      estimateLessonMinutes([
        "hook",
        "explanation",
        "explanation",
        "check",
        "explanation",
        "explanation",
        "check",
        "explanation",
        "check",
        "application",
      ]),
    ).toBe(4);
  });
});

describe(getLessonSpecIssues, () => {
  it("passes a lesson with a hook, checks every few screens and one application", () => {
    expect(getCodes(spec(validScreens))).toStrictEqual([]);
  });

  it("flags too many skills, too many screens and a lesson that runs too long", () => {
    const skills = ["A", "B", "C", "D"].map((name) => skill(name));

    const screens = [
      screen("hook", []),
      ...skills.flatMap((_, index) => [
        screen("explanation", [index]),
        screen("workedExample", [index]),
        screen("check", [index]),
      ]),
      screen("application", [0, 1, 2, 3]),
    ];

    expect(getCodes(spec(screens, skills))).toStrictEqual(["skillCount", "screenCount", "tooLong"]);
  });

  it("allows one unsplittable advanced idea to run to six minutes", () => {
    const screens = [
      screen("hook", []),
      screen("explanation"),
      screen("workedExample"),
      screen("check"),
      screen("workedExample"),
      screen("workedExample"),
      screen("check"),
      screen("workedExample"),
      screen("explanation"),
      screen("check"),
      screen("application"),
    ];

    const lesson = spec(screens, [skill("Derive the energy levels of a particle in a box", true)]);

    expect(lesson.estimatedMinutes).toBe(6);
    expect(getCodes(lesson, "advanced")).toStrictEqual([]);
    expect(getCodes(lesson, "beginner")).toStrictEqual(["tooLong"]);
  });

  it("requires the hook first and exactly one application at the end", () => {
    const noHook = spec([screen("explanation"), ...validScreens.slice(1)]);
    const applicationInMiddle = spec([...validScreens.slice(0, -1), screen("check")]);

    expect(getCodes(noHook)).toContain("hook");
    expect(getCodes(applicationInMiddle)).toContain("application");
  });

  it("flags more than three teaching screens without a check", () => {
    const screens = [
      screen("hook", []),
      screen("explanation"),
      screen("explanation"),
      screen("workedExample"),
      screen("explanation"),
      screen("check"),
      screen("application"),
    ];

    expect(getCodes(spec(screens))).toStrictEqual(["checkGap"]);
  });

  it("asks a new learner's lesson for two teaching screens before its first check", () => {
    const early = spec([
      screen("hook", []),
      screen("explanation"),
      screen("check"),
      screen("explanation"),
      screen("check"),
      screen("application"),
    ]);

    expect(getCodes(early, "beginner", true)).toContain("earlyCheck");
    expect(getCodes(early)).not.toContain("earlyCheck");
    expect(getCodes(spec(illustratedScreens), "beginner", true)).toStrictEqual([]);
  });

  it("asks a shared lesson for a visual on one teaching screen in three, rounded up", () => {
    const longLesson = [
      screen("hook", [], { visual: "The shop" }),
      screen("explanation"),
      screen("explanation"),
      screen("check"),
      screen("explanation"),
      screen("explanation"),
      screen("check"),
      screen("explanation"),
      screen("explanation"),
      screen("check"),
      screen("explanation"),
      screen("application"),
    ];

    const showing = (shown: number[]) =>
      spec(
        longLesson.map((item, index) =>
          shown.includes(index) ? { ...item, visual: `Picture ${index}` } : item,
        ),
      );

    expect(getCodes(showing([1, 4]), "beginner", true)).toStrictEqual(["teachingVisual"]);
    expect(getCodes(showing([1, 4]), "advanced", false, true)).toStrictEqual(["teachingVisual"]);
    expect(getCodes(showing([1, 4, 8]), "beginner", true)).toStrictEqual([]);
  });

  it("asks a shared lesson for its hook's picture and one more visual, and a private one for neither", () => {
    expect(getCodes(spec(validScreens), "beginner", true)).toStrictEqual([
      "hookPicture",
      "teachingVisual",
    ]);

    expect(getCodes(spec(validScreens), "intermediate", false, true)).toStrictEqual([
      "hookPicture",
      "teachingVisual",
    ]);

    expect(getCodes(spec(validScreens), "beginner", true, false)).toStrictEqual([]);

    const explored = validScreens.map((item, index) =>
      index === 0 ? { ...item, visual: "The shop" } : item,
    );

    explored[2] = screen("explanation", [0], { activityTemplate: "formulaModel" });

    expect(getCodes(spec(explored), "beginner", true)).toStrictEqual([]);
  });

  it("places one guess after the story's first explanation", () => {
    const guessed = (at: number) => {
      const screens = [...validScreens];
      screens.splice(at, 0, screen("guess"));
      return spec(screens);
    };

    expect(getCodes(guessed(2))).toStrictEqual([]);
    expect(getCodes(guessed(1))).toStrictEqual(["guess"]);

    const twice = [...validScreens];
    twice.splice(2, 0, screen("guess"));
    twice.splice(4, 0, screen("guess"));

    expect(getCodes(spec(twice))).toStrictEqual(["guess"]);
  });

  it("checks the support mode against the screen after the hook", () => {
    const questionFirst = [
      screen("hook", []),
      screen("check"),
      screen("explanation"),
      screen("explanation"),
      screen("check"),
      screen("application"),
    ];

    expect(getCodes({ ...spec(questionFirst), supportMode: "questionFirst" })).toStrictEqual([]);
    expect(getCodes(spec(questionFirst))).toStrictEqual(["supportMode"]);
  });

  it("requires a worked example for each hard skill and every skill taught and practiced", () => {
    const skills = [skill("Solve a linear equation", true), skill("Check a solution")];

    const screens = [
      screen("hook", []),
      screen("explanation", [0]),
      screen("check", [0]),
      screen("explanation", [0]),
      screen("check", [0]),
      screen("application", [0]),
    ];

    expect(getCodes(spec(screens, skills))).toStrictEqual([
      "workedExample",
      "untaughtSkill",
      "unpracticedSkill",
    ]);
  });

  it("counts an activity as teaching and practice but requires its template", () => {
    const screens = [
      screen("hook", []),
      screen("explanation"),
      screen("activity", [0], { activityTemplate: "slider-graph" }),
      screen("explanation"),
      screen("activity"),
      screen("application"),
    ];

    expect(getCodes(spec(screens))).toStrictEqual(["activityTemplate"]);
  });

  it("flags screens that point at no skill or a missing one", () => {
    const screens = validScreens.map((item, index) =>
      index === 2 ? { ...item, skills: [4] } : item,
    );

    expect(getCodes(spec(screens))).toStrictEqual(["skillReference"]);
  });
});

describe(fitsLesson, () => {
  it("fits up to three skills, twelve screens and five minutes", () => {
    expect(fitsLesson({ level: "beginner", spec: spec(validScreens) })).toBe(true);

    const long = spec([...validScreens.slice(0, -1), ...validScreens]);

    expect(long.screens).toHaveLength(13);
    expect(fitsLesson({ level: "beginner", spec: long })).toBe(false);
  });
});
