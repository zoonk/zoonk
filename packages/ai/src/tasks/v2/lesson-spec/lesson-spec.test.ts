import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { generateLessonSpec } from "./lesson-spec";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("./lesson-spec.prompt.md", () => ({
  default: [
    "Plan the lesson.",
    "{{#exams}}",
    "Plan it for the exams.",
    "{{/exams}}",
    "{{#material}}",
    "Plan it from the material.",
    "{{/material}}",
    "{{#sources}}",
    "Plan it from the sources.",
    "{{/sources}}",
    "{{#setup}}",
    "Plan the setup.",
    "{{/setup}}",
    "{{#shortAnswers}}",
    "Ask it in their own words.",
    "{{/shortAnswers}}",
    "Check the plan.",
  ].join("\n"),
}));

vi.mock("./quick-lesson.prompt.md", () => ({ default: "This is a quick lesson." }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

function rawSkill(topic: string) {
  return {
    description: `${topic} idea.`,
    example: `${topic} example`,
    hard: false,
    name: `Find the ${topic.toLowerCase()}`,
    topic,
    useCase: `${topic} at work`,
  };
}

function rawScreen(kind: string, skills: number[], activityTemplate: string | null = null) {
  return { activityTemplate, brief: kind, kind, skills, visual: null };
}

function oneSkillLesson({ kinds, title }: { kinds: string[]; title: string }) {
  return {
    canDo: "Read a thermometer",
    description: "Temperatures below zero.",
    screens: kinds.map((kind) => rawScreen(kind, kind === "hook" ? [] : [1])),
    skills: [rawSkill("Temperature")],
    supportMode: "explanationFirst",
    title,
  };
}

describe(generateLessonSpec, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns specs with skill indexes, catalog-only activities and oversized lessons split", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({
        lessons: [
          {
            canDo: "Summarize a data set",
            description: "Center and spread.",
            screens: [
              rawScreen("hook", []),
              rawScreen("explanation", [1]),
              rawScreen("activity", [1], "madeUpChart"),
              rawScreen("explanation", [2]),
              rawScreen("activity", [2], "numberLine"),
              rawScreen("explanation", [3]),
              rawScreen("check", [3]),
              rawScreen("explanation", [4]),
              rawScreen("check", [4]),
              rawScreen("application", [1, 2, 3, 4]),
            ],
            skills: ["Mean", "Median", "Mode", "Range"].map((topic) => rawSkill(topic)),
            supportMode: "explanationFirst",
            title: "Summarizing a data set",
          },
        ],
      }),
    );

    const { data } = await generateLessonSpec({
      activityTemplates: [
        { description: "Jump along a number line.", explore: true, id: "numberLine" },
      ],
      chapterTitle: "Describing data",
      courseTitle: "Statistics",
      language: "en",
      lessonDescription: "Center and spread.",
      lessonTitle: "Summarizing a data set",
      level: "beginner",
    });

    expect(data.lessons.map((lesson) => lesson.title)).toStrictEqual([
      "Mean and Median",
      "Mode and Range",
    ]);

    expect(
      data.lessons[0]?.screens.map((screen) => [
        screen.kind,
        screen.skills,
        screen.activityTemplate,
      ]),
    ).toStrictEqual([
      ["hook", [0], null],
      ["explanation", [0], null],
      ["check", [0], null],
      ["explanation", [1], null],
      ["activity", [1], "numberLine"],
      ["application", [0, 1], null],
    ]);
  });

  it("plans the lesson again when its plan breaks a shape rule, and keeps the better plan", async () => {
    // Four teaching screens in a row: a check comes every 2 or 3 screens.
    const longRun = oneSkillLesson({
      kinds: [
        "hook",
        "explanation",
        "explanation",
        "workedExample",
        "explanation",
        "check",
        "application",
      ],
      title: "Long run",
    });

    const fixed = oneSkillLesson({
      kinds: [
        "hook",
        "explanation",
        "check",
        "explanation",
        "workedExample",
        "check",
        "application",
      ],
      title: "Fixed",
    });

    vi.mocked(generateText)
      .mockResolvedValueOnce(createGenerateTextResult({ lessons: [longRun] }))
      .mockResolvedValueOnce(createGenerateTextResult({ lessons: [fixed] }));

    const params = {
      activityTemplates: [],
      chapterTitle: "Temperature",
      courseTitle: "Weather",
      language: "en",
      lessonDescription: "Temperatures below zero.",
      lessonTitle: "Below zero",
      level: "beginner",
    } satisfies Parameters<typeof generateLessonSpec>[0];

    const replanned = await generateLessonSpec(params);

    expect(generateText).toHaveBeenCalledTimes(2);
    expect(replanned.data.lessons.map((spec) => spec.title)).toStrictEqual(["Fixed"]);

    // A second plan that's no better leaves the first one, and a good plan is planned once.
    vi.mocked(generateText)
      .mockResolvedValueOnce(createGenerateTextResult({ lessons: [longRun] }))
      .mockResolvedValueOnce(createGenerateTextResult({ lessons: [longRun] }))
      .mockResolvedValueOnce(createGenerateTextResult({ lessons: [fixed] }));

    const kept = await generateLessonSpec(params);
    const planned = await generateLessonSpec(params);

    expect(kept.data.lessons[0]?.title).toBe("Long run");
    expect(planned.data.lessons[0]?.title).toBe("Fixed");
    expect(generateText).toHaveBeenCalledTimes(5);
  });

  it("plans a quick lesson as one lesson, never split, with the quick lesson rules only for it", async () => {
    const lesson = {
      canDo: "Relacionar estrutura proteica e função",
      description: "As ideias centrais de proteínas e enzimas.",
      screens: [
        rawScreen("hook", []),
        rawScreen("explanation", [1]),
        rawScreen("explanation", [2]),
        rawScreen("check", [2]),
        rawScreen("workedExample", [1, 2]),
        rawScreen("check", [1]),
        rawScreen("application", [1, 2]),
      ],
      skills: ["Estrutura", "Enzima"].map((topic) => rawSkill(topic)),
      supportMode: "explanationFirst",
      title: "Proteínas e enzimas",
    };

    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({ lessons: [lesson, { ...lesson, title: "Uma segunda" }] }),
    );

    const params = {
      activityTemplates: [],
      chapterTitle: "Biomoléculas",
      courseTitle: "Biologia",
      language: "pt",
      lessonDescription: "As ideias centrais de proteínas e enzimas.",
      lessonTitle: "Aula rápida: Relacionar estrutura proteica e função",
      level: "intermediate",
      quick: true,
      skills: ["Relacionar estrutura proteica e função"],
    } satisfies Parameters<typeof generateLessonSpec>[0];

    const { data, systemPrompt, userPrompt } = await generateLessonSpec(params);

    expect(systemPrompt).toBe("Plan the lesson.\nCheck the plan.\nThis is a quick lesson.");
    expect(data.lessons.map((spec) => spec.title)).toStrictEqual(["Proteínas e enzimas"]);
    expect(data.lessons[0]?.screens).toHaveLength(lesson.screens.length);

    // Every other lesson is planned with the regular rules alone.
    vi.mocked(generateText).mockResolvedValueOnce(createGenerateTextResult({ lessons: [lesson] }));

    const regular = await generateLessonSpec({ ...params, quick: false });

    expect(regular.systemPrompt).toBe("Plan the lesson.\nCheck the plan.");
    expect(regular.userPrompt).toBe(userPrompt);
  });

  it("keeps only its own variants' rules, in place, and quick lessons' rules last", async () => {
    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({
        lessons: [
          {
            canDo: "Read a temperature",
            description: "Temperatures.",
            screens: [rawScreen("hook", []), rawScreen("explanation", [1])],
            skills: [rawSkill("Temperature")],
            supportMode: "explanationFirst",
            title: "Temperatures",
          },
        ],
      }),
    );

    const params = {
      activityTemplates: [],
      chapterTitle: "Temperature",
      courseTitle: "Weather",
      language: "en",
      lessonDescription: "Temperatures.",
      lessonTitle: "Temperatures",
      level: "beginner",
    } satisfies Parameters<typeof generateLessonSpec>[0];

    const exams = [{ name: "ENEM", style: "Multiple choice with a text." }];

    const [regular, exam, material, sources, setup, quickExam, written] = await Promise.all([
      generateLessonSpec(params),
      generateLessonSpec({ ...params, exams }),
      generateLessonSpec({ ...params, exams: [], material: "<page>Slides</page>" }),
      generateLessonSpec({ ...params, sources: "<page>Law</page>" }),
      generateLessonSpec({ ...params, setup: true }),
      generateLessonSpec({ ...params, exams, quick: true }),
      generateLessonSpec({ ...params, shortAnswers: true }),
    ]);

    expect(regular.systemPrompt).toBe("Plan the lesson.\nCheck the plan.");
    expect(exam.systemPrompt).toBe("Plan the lesson.\nPlan it for the exams.\nCheck the plan.");

    expect(material.systemPrompt).toBe(
      "Plan the lesson.\nPlan it from the material.\nCheck the plan.",
    );

    expect(sources.systemPrompt).toBe(
      "Plan the lesson.\nPlan it from the sources.\nCheck the plan.",
    );

    expect(setup.systemPrompt).toBe("Plan the lesson.\nPlan the setup.\nCheck the plan.");

    expect(quickExam.systemPrompt).toBe(
      "Plan the lesson.\nPlan it for the exams.\nCheck the plan.\nThis is a quick lesson.",
    );

    expect(written.systemPrompt).toBe(
      "Plan the lesson.\nAsk it in their own words.\nCheck the plan.",
    );
  });
});
