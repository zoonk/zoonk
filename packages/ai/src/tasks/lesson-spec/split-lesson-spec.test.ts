import { describe, expect, it } from "vitest";
import {
  type LessonScreen,
  type LessonScreenKind,
  type LessonSpec,
  type LessonSpecSkill,
  estimateLessonMinutes,
  getLessonSpecIssues,
} from "./lesson-spec-rules";
import { splitLessonSpec } from "./split-lesson-spec";

function skill(topic: string): LessonSpecSkill {
  return {
    description: `${topic} in one sentence.`,
    example: `${topic} example`,
    hard: false,
    name: `Use ${topic}`,
    topic,
    useCase: `${topic} at work`,
  };
}

function screen(kind: LessonScreenKind, skills: number[], brief: string = kind): LessonScreen {
  return { activityTemplate: null, brief, kind, skills, visual: null };
}

function spec({
  screens,
  skills,
  supportMode = "explanationFirst",
}: {
  screens: LessonScreen[];
  skills: LessonSpecSkill[];
  supportMode?: LessonSpec["supportMode"];
}): LessonSpec {
  return {
    canDo: "Summarize a data set",
    description: "Original description.",
    estimatedMinutes: estimateLessonMinutes(screens.map((item) => item.kind)),
    screens,
    skills,
    supportMode,
    title: "Original title",
  };
}

/** Each skill gets an explanation and a check, so four skills fit on screens and time but not on skills. */
function fourSkillSpec(): LessonSpec {
  const skills = ["Mean", "Median", "Mode", "Range"].map((topic) => skill(topic));

  return spec({
    screens: [
      screen("hook", [], "original hook"),
      ...skills.flatMap((_, index) => [
        screen("explanation", [index]),
        screen("check", [index], `check ${index}`),
      ]),
      screen("application", [0, 1, 2, 3], "original application"),
    ],
    skills,
  });
}

function longSkillScreens(index: number): LessonScreen[] {
  return [
    screen("explanation", [index]),
    screen("workedExample", [index]),
    screen("check", [index]),
    screen("explanation", [index]),
    screen("check", [index]),
  ];
}

describe(splitLessonSpec, () => {
  it("keeps a lesson that fits as it is", () => {
    const lesson = spec({
      screens: [
        screen("hook", []),
        screen("explanation", [0]),
        screen("check", [0]),
        screen("explanation", [0]),
        screen("check", [0]),
        screen("application", [0]),
      ],
      skills: [skill("Mean")],
    });

    expect(splitLessonSpec({ language: "en", level: "beginner", spec: lesson })).toStrictEqual([
      lesson,
    ]);
  });

  it("splits more than three skills into the fewest, most even lessons in teaching order", () => {
    const lessons = splitLessonSpec({ language: "en", level: "beginner", spec: fourSkillSpec() });

    expect(lessons.map((lesson) => lesson.title)).toStrictEqual([
      "Mean and Median",
      "Mode and Range",
    ]);

    expect(lessons.map((lesson) => lesson.skills.map((item) => item.topic))).toStrictEqual([
      ["Mean", "Median"],
      ["Mode", "Range"],
    ]);

    expect(lessons.map((lesson) => lesson.canDo)).toStrictEqual(["Use Mean", "Use Mode"]);
  });

  it("gives every new lesson a hook and one application and passes the lesson rules", () => {
    const [first, second] = splitLessonSpec({
      language: "en",
      level: "beginner",
      spec: fourSkillSpec(),
    });

    expect(first?.screens[0]).toStrictEqual(screen("hook", [0], "original hook"));
    expect(first?.screens.at(-1)).toStrictEqual(screen("application", [0, 1], "Median at work"));
    expect(second?.screens[0]).toStrictEqual(screen("hook", [0], "Mode at work"));

    expect(second?.screens.at(-1)).toStrictEqual(
      screen("application", [0, 1], "original application"),
    );

    expect(second?.screens.map((item) => item.brief)).toStrictEqual([
      "Mode at work",
      "explanation",
      "check 2",
      "explanation",
      "check 3",
      "original application",
    ]);

    expect(getLessonSpecIssues({ level: "beginner", spec: first! })).toStrictEqual([]);
    expect(getLessonSpecIssues({ level: "beginner", spec: second! })).toStrictEqual([]);
  });

  it("recomputes minutes for each new lesson", () => {
    const lessons = splitLessonSpec({ language: "en", level: "beginner", spec: fourSkillSpec() });

    expect(lessons.map((lesson) => lesson.estimatedMinutes)).toStrictEqual([
      estimateLessonMinutes(lessons[0]!.screens.map((item) => item.kind)),
      estimateLessonMinutes(lessons[1]!.screens.map((item) => item.kind)),
    ]);
  });

  it("starts a new lesson when a skill would pass twelve screens or five minutes", () => {
    const skills = ["Mean", "Median", "Mode"].map((topic) => skill(topic));

    const lessons = splitLessonSpec({
      language: "pt",
      level: "beginner",
      spec: spec({
        screens: [
          screen("hook", []),
          ...longSkillScreens(0),
          ...longSkillScreens(1),
          ...longSkillScreens(2),
          screen("application", [0, 1, 2]),
        ],
        skills,
      }),
    });

    expect(lessons.map((lesson) => lesson.title)).toStrictEqual(["Mean e Median", "Mode"]);
    expect(lessons.map((lesson) => lesson.screens.length)).toStrictEqual([12, 7]);
    expect(lessons.every((lesson) => lesson.estimatedMinutes <= 5)).toBe(true);
  });

  it("keeps a screen about two skills with the later one and drops the skill it lost", () => {
    const skills = ["Mean", "Median", "Mode", "Range"].map((topic) => skill(topic));
    const base = fourSkillSpec();

    const screens = base.screens.map((item) =>
      item.brief === "check 3" ? screen("check", [1, 3], "compare median and range") : item,
    );

    const [, second] = splitLessonSpec({
      language: "en",
      level: "beginner",
      spec: spec({ screens, skills }),
    });

    expect(
      second?.screens.find((item) => item.brief === "compare median and range")?.skills,
    ).toStrictEqual([1]);
  });

  it("prefers an even cut over leaving a lesson below five screens", () => {
    const skills = ["Mean", "Median", "Mode"].map((topic) => skill(topic));

    const lessons = splitLessonSpec({
      language: "en",
      level: "beginner",
      spec: spec({
        screens: [
          screen("hook", []),
          ...longSkillScreens(0),
          screen("explanation", [1]),
          screen("check", [1]),
          screen("explanation", [1]),
          screen("check", [1]),
          screen("explanation", [2]),
          screen("check", [2]),
          screen("application", [0, 1, 2]),
        ],
        skills,
      }),
    });

    expect(lessons.map((lesson) => lesson.title)).toStrictEqual(["Mean", "Median and Mode"]);
    expect(lessons.map((lesson) => lesson.screens.length)).toStrictEqual([7, 8]);
  });

  it("derives the support mode of each new lesson from its first screens", () => {
    const skills = ["Mean", "Median", "Mode", "Range"].map((topic) => skill(topic));

    const screens = [
      screen("hook", []),
      ...skills.flatMap((_, index) => [screen("check", [index]), screen("explanation", [index])]),
      screen("application", [0, 1, 2, 3]),
    ];

    const lessons = splitLessonSpec({
      language: "en",
      level: "beginner",
      spec: spec({ screens, skills, supportMode: "questionFirst" }),
    });

    expect(lessons.map((lesson) => lesson.supportMode)).toStrictEqual([
      "questionFirst",
      "questionFirst",
    ]);
  });

  it("never cuts a single skill in half, even when it is too long", () => {
    const lesson = spec({
      screens: [
        screen("hook", []),
        ...longSkillScreens(0),
        ...longSkillScreens(0),
        screen("application", [0]),
      ],
      skills: [skill("Standard deviation")],
    });

    expect(splitLessonSpec({ language: "en", level: "beginner", spec: lesson })).toStrictEqual([
      lesson,
    ]);
  });
});
