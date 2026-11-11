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
    "{{#novice}}",
    "Show it to a newcomer.",
    "{{/novice}}",
    "{{#product}}",
    "Plan it in the product.",
    "{{/product}}",
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
  return { activityTemplate, brief: kind, kind, skills, visual: null, visualKind: "none" };
}

function oneSkillLesson({ kinds, title }: { kinds: string[]; title: string }) {
  return {
    canDo: "Read a thermometer",
    description: "Temperatures below zero.",
    screens: kinds.map((kind, index) => ({
      ...rawScreen(kind, kind === "hook" ? [] : [1]),
      ...(["hook", "explanation", "workedExample"].includes(kind)
        ? { visual: `A thermometer below zero ${index}`, visualKind: "picture" }
        : {}),
    })),
    skills: [rawSkill("Temperature")],
    title,
  };
}

function twoSkillLesson(topics: [string, string]) {
  return {
    canDo: `Find the ${topics[0].toLowerCase()} and the ${topics[1].toLowerCase()}`,
    description: `${topics[0]} and ${topics[1]}.`,
    screens: [
      { ...rawScreen("hook", []), brief: `Ana's bakery scene for ${topics[0]}` },
      rawScreen("explanation", [1]),
      rawScreen("guess", [1]),
      rawScreen("explanation", [1]),
      rawScreen("check", [1]),
      rawScreen("explanation", [2]),
      rawScreen("activity", [2], "madeUpChart"),
      { ...rawScreen("application", [1, 2]), brief: `Ana decides with ${topics[1]}` },
    ],
    skills: topics.map((topic) => rawSkill(topic)),
    title: `${topics[0]} and ${topics[1]}`,
  };
}

describe(generateLessonSpec, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the planner's own lessons as written, hooks and applications included, with catalog-only activities", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({
        lessons: [twoSkillLesson(["Mean", "Median"]), twoSkillLesson(["Mode", "Range"])],
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

    expect(generateText).toHaveBeenCalledOnce();

    expect(
      data.lessons.map((lesson) => [
        lesson.title,
        lesson.screens[0]?.brief,
        lesson.screens.at(-1)?.brief,
      ]),
    ).toStrictEqual([
      ["Mean and Median", "Ana's bakery scene for Mean", "Ana decides with Median"],
      ["Mode and Range", "Ana's bakery scene for Mode", "Ana decides with Range"],
    ]);

    expect(
      data.lessons[0]?.screens.map((screen) => [
        screen.kind,
        screen.skills,
        screen.activityTemplate,
      ]),
    ).toStrictEqual([
      ["hook", [], null],
      ["explanation", [0], null],
      ["guess", [0], null],
      ["explanation", [0], null],
      ["check", [0], null],
      ["explanation", [1], null],
      ["check", [1], null],
      ["application", [0, 1], null],
    ]);
  });

  it("keeps a lesson past the size targets whole, without planning it again", async () => {
    const long = oneSkillLesson({
      kinds: [
        "hook",
        "explanation",
        "guess",
        "workedExample",
        "check",
        "workedExample",
        "check",
        "workedExample",
        "check",
        "workedExample",
        "check",
        "explanation",
        "check",
        "workedExample",
        "check",
        "application",
      ],
      title: "Long",
    });

    vi.mocked(generateText).mockResolvedValueOnce(createGenerateTextResult({ lessons: [long] }));

    const { data } = await generateLessonSpec({
      activityTemplates: [],
      chapterTitle: "Temperature",
      courseTitle: "Weather",
      language: "en",
      lessonDescription: "Temperatures below zero.",
      lessonTitle: "Below zero",
      level: "beginner",
    });

    expect(generateText).toHaveBeenCalledOnce();

    expect(data.lessons.map((spec) => [spec.title, spec.estimatedMinutes])).toStrictEqual([
      ["Long", 8],
    ]);
  });

  it("plans the lesson again when its plan breaks a shape rule, and keeps the better plan", async () => {
    const noApplication = oneSkillLesson({
      kinds: ["hook", "explanation", "guess", "explanation", "check"],
      title: "No application",
    });

    const fixed = oneSkillLesson({
      kinds: ["hook", "explanation", "guess", "explanation", "check", "application"],
      title: "Fixed",
    });

    vi.mocked(generateText)
      .mockResolvedValueOnce(createGenerateTextResult({ lessons: [noApplication] }))
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
      .mockResolvedValueOnce(createGenerateTextResult({ lessons: [noApplication] }))
      .mockResolvedValueOnce(createGenerateTextResult({ lessons: [noApplication] }))
      .mockResolvedValueOnce(createGenerateTextResult({ lessons: [fixed] }));

    const kept = await generateLessonSpec(params);
    const planned = await generateLessonSpec(params);

    expect(kept.data.lessons[0]?.title).toBe("No application");
    expect(planned.data.lessons[0]?.title).toBe("Fixed");
    expect(generateText).toHaveBeenCalledTimes(5);
  });

  it("keeps teaching screens planned with nothing bare, without planning again", async () => {
    const bare = oneSkillLesson({
      kinds: ["hook", "explanation", "guess", "explanation", "check", "application"],
      title: "Bare",
    });

    const screens = bare.screens.map((screen) => ({ ...screen, visual: null, visualKind: "none" }));

    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({ lessons: [{ ...bare, screens }] }),
    );

    const { data } = await generateLessonSpec({
      activityTemplates: [],
      chapterTitle: "Temperature",
      courseTitle: "Weather",
      language: "en",
      lessonDescription: "Temperatures below zero.",
      lessonTitle: "Below zero",
      level: "beginner",
    });

    expect(generateText).toHaveBeenCalledOnce();

    expect(data.lessons[0]?.screens.map((screen) => screen.visualKind)).toStrictEqual(
      screens.map(() => "none"),
    );
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
      level: "intermediate",
    } satisfies Parameters<typeof generateLessonSpec>[0];

    const exams = [{ name: "ENEM", style: "Multiple choice with a text." }];

    const [regular, beginner, beginnerExam, exam, material, sources, setup, quickExam, written] =
      await Promise.all([
        generateLessonSpec(params),
        generateLessonSpec({ ...params, level: "beginner" }),
        generateLessonSpec({ ...params, exams, level: "beginner" }),
        generateLessonSpec({ ...params, exams }),
        generateLessonSpec({ ...params, exams: [], material: "<page>Slides</page>" }),
        generateLessonSpec({ ...params, sources: "<page>Law</page>" }),
        generateLessonSpec({ ...params, setup: true }),
        generateLessonSpec({ ...params, exams, quick: true }),
        generateLessonSpec({ ...params, shortAnswers: true }),
      ]);

    expect(regular.systemPrompt).toBe("Plan the lesson.\nCheck the plan.");
    expect(beginner.systemPrompt).toBe("Plan the lesson.\nShow it to a newcomer.\nCheck the plan.");

    expect(beginnerExam.systemPrompt).toBe(
      "Plan the lesson.\nPlan it for the exams.\nCheck the plan.",
    );

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

  it("plans a product course's lesson in the product, for the release it's written for", async () => {
    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({
        lessons: [oneSkillLesson({ kinds: ["hook", "explanation"], title: "Pairing" })],
      }),
    );

    const params = {
      activityTemplates: [],
      chapterTitle: "Get started",
      courseTitle: "Gizmo",
      language: "en",
      lessonDescription: "Pair the remote.",
      lessonTitle: "Pairing",
      level: "beginner",
    } satisfies Parameters<typeof generateLessonSpec>[0];

    const [product, general] = await Promise.all([
      generateLessonSpec({
        ...params,
        product: { brand: "Acme", name: "Gizmo", release: { name: "Gizmo 2", releasedOn: null } },
      }),
      generateLessonSpec(params),
    ]);

    expect(product.systemPrompt).toContain("Plan it in the product.");

    expect(product.userPrompt).toContain(
      "COURSE_TITLE: Gizmo\n    PRODUCT: Gizmo by Acme, written for Gizmo 2\n",
    );

    expect(general.systemPrompt).not.toContain("Plan it in the product.");
    expect(general.userPrompt).not.toContain("PRODUCT");
  });
});
