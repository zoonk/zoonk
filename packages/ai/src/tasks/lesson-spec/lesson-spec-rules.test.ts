import { describe, expect, it } from "vitest";
import {
  type LessonScreen,
  type LessonScreenKind,
  type LessonSpec,
  type LessonSpecSkill,
  estimateLessonMinutes,
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

function getCodes(lesson: LessonSpec) {
  return getLessonSpecIssues(lesson).map((issue) => issue.code);
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

  it("leaves size to the planner's targets, so a long lesson with many skills breaks no rule", () => {
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

    const lesson = spec(screens, skills);

    expect(lesson.screens).toHaveLength(19);
    expect(lesson.estimatedMinutes).toBe(8);
    expect(getCodes(lesson)).toStrictEqual([]);
  });

  it("requires the hook first and exactly one application at the end", () => {
    const noHook = spec([screen("explanation"), ...validScreens.slice(1)]);
    const applicationInMiddle = spec([...validScreens.slice(0, -1), screen("check")]);

    expect(getCodes(noHook)).toContain("hook");
    expect(getCodes(applicationInMiddle)).toContain("application");
  });

  it("leaves pacing to the planner's targets, so a long run, an early check or a missing or extra guess breaks no rule", () => {
    const longRun = spec([
      screen("hook", []),
      screen("explanation"),
      screen("guess"),
      screen("explanation"),
      screen("workedExample"),
      screen("explanation"),
      screen("explanation"),
      screen("check"),
      screen("application"),
    ]);

    const checkFirst = spec([
      screen("hook", []),
      screen("check"),
      screen("explanation"),
      screen("guess"),
      screen("explanation"),
      screen("application"),
    ]);

    const lateGuess = spec([
      screen("hook", []),
      screen("explanation"),
      screen("explanation"),
      screen("check"),
      screen("guess"),
      screen("explanation"),
      screen("application"),
    ]);

    const noGuess = spec(validScreens.filter((item) => item.kind !== "guess"));

    const twoGuesses = spec([
      ...validScreens.slice(0, 4),
      screen("guess"),
      ...validScreens.slice(4),
    ]);

    expect(getCodes(longRun)).toStrictEqual([]);
    expect(getCodes(checkFirst)).toStrictEqual([]);
    expect(getCodes(lateGuess)).toStrictEqual([]);
    expect(getCodes(noGuess)).toStrictEqual([]);
    expect(getCodes(twoGuesses)).toStrictEqual([]);
  });

  it("requires every skill taught and practiced, but leaves a hard skill's worked example to the planner", () => {
    const skills = [skill("Solve a linear equation", true), skill("Check a solution")];

    const screens = [
      screen("hook", []),
      screen("explanation", [0]),
      screen("guess", [0]),
      screen("explanation", [0]),
      screen("check", [0]),
      screen("application", [0]),
    ];

    expect(getCodes(spec(screens, skills))).toStrictEqual(["untaughtSkill", "unpracticedSkill"]);
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
