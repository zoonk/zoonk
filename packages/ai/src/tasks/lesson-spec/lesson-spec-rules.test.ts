import { describe, expect, it } from "vitest";
import { type VisualFloor } from "../_utils/visual-floor";
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

function screen(
  kind: LessonScreenKind,
  skills: number[] = [0],
  extra: Partial<LessonScreen> = {},
): LessonScreen {
  return {
    activityTemplate: null,
    brief: kind,
    kind,
    skills,
    visual: null,
    visualKind: "none",
    ...extra,
  };
}

function picture(item: LessonScreen, index: number): LessonScreen {
  return { ...item, visual: `Picture ${index}`, visualKind: "picture" };
}

function spec(screens: LessonScreen[], skills = [skill("Calculate a percent change")]): LessonSpec {
  return {
    canDo: "Calculate a percent change",
    description: "d",
    estimatedMinutes: estimateLessonMinutes(screens.map((item) => item.kind)),
    screens,
    skills,
    title: "Percent change",
  };
}

const validScreens = [
  screen("hook", []),
  screen("explanation"),
  screen("guess"),
  screen("explanation"),
  screen("check"),
  screen("explanation"),
  screen("check"),
  screen("application"),
];

const illustratedScreens = validScreens.map((item, index) =>
  [0, 1, 3, 5].includes(index) ? picture(item, index) : item,
);

function getCodes(
  lesson: LessonSpec,
  level: CourseLevel = "beginner",
  novice = false,
  visualFloor: VisualFloor | undefined = novice ? "pictures" : undefined,
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
    ).toBe(3);
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
        ...(index === 0 ? [screen("guess", [index])] : []),
        screen("workedExample", [index]),
        screen("check", [index]),
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
      screen("guess"),
      screen("workedExample"),
      screen("check"),
      screen("workedExample"),
      screen("workedExample"),
      screen("check"),
      screen("workedExample"),
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

  it("flags more than four teaching screens without a check", () => {
    const screens = [
      screen("hook", []),
      screen("explanation"),
      screen("guess"),
      screen("explanation"),
      screen("workedExample"),
      screen("explanation"),
      screen("explanation"),
      screen("check"),
      screen("application"),
    ];

    expect(getCodes(spec(screens))).toStrictEqual(["checkGap"]);
  });

  it("teaches before the first check at every level, and twice for a new learner", () => {
    const early = spec([
      screen("hook", []),
      screen("explanation"),
      screen("guess"),
      screen("explanation"),
      screen("check"),
      screen("application"),
    ]);

    const questionFirst = spec([
      screen("hook", []),
      screen("check"),
      screen("explanation"),
      screen("guess"),
      screen("explanation"),
      screen("check"),
      screen("application"),
    ]);

    const oneScreenFirst = spec([
      screen("hook", []),
      screen("explanation"),
      screen("check"),
      screen("explanation"),
      screen("check"),
      screen("application"),
    ]);

    expect(getCodes(early)).toStrictEqual([]);
    expect(getCodes(questionFirst, "advanced")).toContain("earlyCheck");

    expect(
      getLessonSpecIssues({ level: "beginner", novice: true, spec: oneScreenFirst }).map(
        (issue) => issue.code,
      ),
    ).toContain("earlyCheck");

    expect(getCodes(oneScreenFirst, "advanced")).not.toContain("earlyCheck");
    expect(getCodes(spec(illustratedScreens), "beginner", true)).toStrictEqual([]);
  });

  it("asks a shared lesson for a visual on every teaching screen", () => {
    const longLesson = [
      picture(screen("hook", []), 0),
      screen("explanation"),
      screen("guess"),
      screen("explanation"),
      screen("check"),
      screen("explanation"),
      screen("explanation"),
      screen("explanation"),
      screen("check"),
      screen("explanation"),
      screen("explanation"),
      screen("application"),
    ];

    const showing = (shown: number[]) =>
      spec(longLesson.map((item, index) => (shown.includes(index) ? picture(item, index) : item)));

    const everyOne = [1, 3, 5, 6, 7, 9, 10];

    expect(getCodes(showing(everyOne.slice(1)), "beginner", true)).toStrictEqual([
      "teachingVisual",
    ]);

    expect(getCodes(showing(everyOne.slice(1)), "advanced", false, "pictures")).toStrictEqual([
      "teachingVisual",
    ]);

    expect(getCodes(showing(everyOne), "beginner", true)).toStrictEqual([]);
  });

  it("counts any visual toward the floor: every teaching screen when shared, one in two for one learner", () => {
    const drawn = validScreens.map((item, index) => {
      if (index === 0 || index === 1) {
        return { ...item, visualKind: "table" as const };
      }

      if (index === 5) {
        return { ...item, activityTemplate: "formulaModel", visualKind: "template" as const };
      }

      return index === 3 ? { ...item, visualKind: "chart" as const } : item;
    });

    const pictured = validScreens.map((item, index) =>
      [0, 3, 5].includes(index) ? picture(item, index) : item,
    );

    const halfDrawn = drawn.map((item, index) =>
      index === 5 ? { ...item, activityTemplate: null, visualKind: "none" as const } : item,
    );

    expect(getCodes(spec(drawn), "beginner", true)).toStrictEqual([]);
    expect(getCodes(spec(halfDrawn), "beginner", true, "drawn")).toStrictEqual([]);
    expect(getCodes(spec(halfDrawn), "beginner", true)).toStrictEqual(["teachingVisual"]);
    expect(getCodes(spec(pictured), "beginner", true, "drawn")).toStrictEqual([]);
  });

  it("asks every lesson for visuals on its teaching screens", () => {
    expect(getCodes(spec(validScreens), "beginner", true)).toStrictEqual(["teachingVisual"]);

    expect(getCodes(spec(validScreens), "intermediate", false, "pictures")).toStrictEqual([
      "teachingVisual",
    ]);

    expect(getCodes(spec(validScreens), "beginner", true, "drawn")).toStrictEqual([
      "teachingVisual",
    ]);

    const explored = validScreens.map((item, index) =>
      index === 1 || index === 5 ? picture(item, index) : item,
    );

    explored[3] = screen("explanation", [0], {
      activityTemplate: "formulaModel",
      visualKind: "template",
    });

    expect(getCodes(spec(explored), "beginner", true)).toStrictEqual([]);
  });

  it("places exactly one guess right after the first explanation, followed by another", () => {
    const withoutGuess = validScreens.filter((item) => item.kind !== "guess");

    const guessed = (at: number) => {
      const screens = [...withoutGuess];
      screens.splice(at, 0, screen("guess"));
      return spec(screens);
    };

    expect(getCodes(guessed(2))).toStrictEqual([]);
    expect(getCodes(guessed(1))).toStrictEqual(["guess"]);
    expect(getCodes(guessed(4))).toStrictEqual(["guess"]);
    expect(getCodes(spec(withoutGuess))).toStrictEqual(["guess"]);

    const twice = [...validScreens];
    twice.splice(4, 0, screen("guess"));

    expect(getCodes(spec(twice))).toStrictEqual(["guess"]);
  });

  it("counts teaching on both sides of the guess as one run", () => {
    const run = [
      screen("hook", []),
      screen("explanation"),
      screen("guess"),
      screen("explanation"),
      screen("explanation"),
      screen("explanation"),
      screen("explanation"),
      screen("check"),
      screen("application"),
    ];

    expect(getCodes(spec(run))).toStrictEqual(["checkGap"]);
  });

  it("requires a worked example for each hard skill and every skill taught and practiced", () => {
    const skills = [skill("Solve a linear equation", true), skill("Check a solution")];

    const screens = [
      screen("hook", []),
      screen("explanation", [0]),
      screen("guess", [0]),
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
      screen("guess"),
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
      index === 3 ? { ...item, skills: [4] } : item,
    );

    expect(getCodes(spec(screens))).toStrictEqual(["skillReference"]);
  });
});

describe(fitsLesson, () => {
  it("fits up to three skills, sixteen screens and five minutes", () => {
    expect(fitsLesson({ level: "beginner", spec: spec(validScreens) })).toBe(true);

    const long = spec([
      ...validScreens.slice(0, -1),
      ...validScreens.slice(1, -1),
      ...validScreens.slice(4),
    ]);

    expect(long.screens).toHaveLength(17);
    expect(fitsLesson({ level: "beginner", spec: long })).toBe(false);
  });
});
