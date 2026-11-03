import { generateText } from "ai";
import { describe, expect, it, vi } from "vitest";
import { getModelFamily } from "../../_utils/model-family";
import { type CallReuse } from "../../provider-options";
import { answerOnceWith } from "../_test-utils/answer-once-with";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { type LessonScreen, type LessonSpec } from "../lesson-spec/lesson-spec-rules";
import { getLessonCheckModels } from "../quality/lesson-check-models";
import { getLessonRewriteModel, getLessonWriterModel, writeLessonDraft } from "./lesson-writer";
import type * as Ai from "ai";

/** Where the schema the answer follows starts, after the writer's rules. */
const OUTPUT_FORMAT = "\n\n# Output format";

vi.mock("server-only", () => ({}));

vi.mock("./lesson-writer.prompt.md", () => ({
  default: [
    "Write the lesson.",
    "{{#spotAiMistake}}",
    "Write the AI's mistake.",
    "{{/spotAiMistake}}",
    "{{#material}}",
    "Write it from the material.",
    "{{/material}}",
    "{{#sources}}",
    "Write it from the sources.",
    "{{/sources}}",
    "{{#exams}}",
    "Write it for the exams.",
    "{{/exams}}",
    "Keep it under {{SCREEN_CHARACTERS}} characters.",
    "{{#novice}}",
    "Show it before asking.",
    "{{/novice}}",
    "{{#setup}}",
    "Write the setup.",
    "{{/setup}}",
    "{{#shortAnswers}}",
    "Write typed answers.",
    "{{/shortAnswers}}",
    "Check it.",
  ].join("\n"),
}));

vi.mock("../items/item-rules/typed-question.prompt.md", () => ({ default: "- One clear ask.\n" }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

function screen(kind: LessonScreen["kind"], activityTemplate: string | null = null): LessonScreen {
  return { activityTemplate, brief: kind, kind, skills: [0], visual: null, visualKind: "none" };
}

function spec(screens: LessonScreen[]): LessonSpec {
  return {
    canDo: "Read a temperature below zero",
    description: "Temperatures below zero.",
    estimatedMinutes: 4,
    screens,
    skills: [
      {
        description: "Below zero, a bigger number is colder.",
        example: "−5 °C is colder than −2 °C.",
        hard: false,
        name: "Read temperatures below zero",
        topic: "Temperature",
        useCase: "A winter forecast",
      },
    ],
    title: "Temperatures below zero",
  };
}

function option(text: string, isCorrect: boolean) {
  return { isCorrect, reason: "Why.", text };
}

const SONNET = "anthropic/claude-sonnet-5.5";
const TERRA = "openai/gpt-6.1-terra";
const ARGON = "google/gemini-4-argon";
const REUSES: CallReuse[] = ["bounded", "library", "personal"];

describe(getLessonWriterModel, () => {
  it("writes lessons other learners read with Sonnet and a learner's own with Terra", () => {
    expect(REUSES.map((reuse) => getLessonWriterModel({ reuse }))).toStrictEqual([
      SONNET,
      SONNET,
      TERRA,
    ]);
  });

  it("gives every writer the chain may serve a reviewer from another family", () => {
    for (const reuse of REUSES) {
      for (const writerModel of [getLessonWriterModel({ reuse }), SONNET, TERRA, ARGON]) {
        const { model } = getLessonCheckModels({ reuse, writerModel });
        expect(getModelFamily(model)).not.toBe(getModelFamily(writerModel));
      }
    }
  });
});

describe(getLessonRewriteModel, () => {
  it("picks the writer chain's first model from a family whose drafts weren't held back", () => {
    expect(getLessonRewriteModel(["openai/gpt-6.1-terra", "openai/gpt-6.1-terra"])).toBe(
      "anthropic/claude-sonnet-5.5",
    );

    expect(getLessonRewriteModel(["google/gemini-4-argon", "google/gemini-4-argon"])).toBe(
      "openai/gpt-6.1-terra",
    );

    // A fallback wrote one of them: both families are left out.
    expect(getLessonRewriteModel(["openai/gpt-6.1-terra", "anthropic/claude-sonnet-5.5"])).toBe(
      "google/gemini-4-argon",
    );
  });
});

const EMPTY_MAP = { ideas: [], shape: "hub" };

describe(writeLessonDraft, () => {
  it("keeps only its own variants' rules, in place, and the date only for setup", async () => {
    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({ screens: [], summary: EMPTY_MAP }),
    );

    const params = {
      activityTemplates: [],
      chapterTitle: "Temperature",
      courseTitle: "Weather",
      language: "en",
      level: "intermediate",
      spec: spec([screen("hook"), screen("explanation"), screen("application")]),
    } satisfies Parameters<typeof writeLessonDraft>[0];

    const findError = spec([screen("hook"), screen("activity", "findError")]);
    const exams = [{ name: "ENEM", style: "Multiple choice with a text." }];

    const [regular, beginner, beginnerExam, spotAi, material, sources, exam, setup, written] =
      await Promise.all([
        writeLessonDraft(params),
        writeLessonDraft({ ...params, level: "beginner" }),
        writeLessonDraft({ ...params, exams, level: "beginner" }),
        writeLessonDraft({ ...params, spec: findError }),
        writeLessonDraft({ ...params, exams: [], material: "<page>Slides</page>" }),
        writeLessonDraft({ ...params, sources: "<page>Law</page>" }),
        writeLessonDraft({ ...params, exams }),
        writeLessonDraft({ ...params, setup: true }),
        writeLessonDraft({ ...params, shortAnswers: true }),
      ]);

    expect(regular.systemPrompt.split(OUTPUT_FORMAT)[0]).toBe(
      "Write the lesson.\nKeep it under 250 characters.\nCheck it.",
    );

    expect(beginner.systemPrompt.split(OUTPUT_FORMAT)[0]).toBe(
      "Write the lesson.\nKeep it under 250 characters.\nShow it before asking.\nCheck it.",
    );

    expect(beginnerExam.systemPrompt.split(OUTPUT_FORMAT)[0]).toBe(
      "Write the lesson.\nWrite it for the exams.\nKeep it under 250 characters.\nCheck it.",
    );

    expect(spotAi.systemPrompt.split(OUTPUT_FORMAT)[0]).toBe(
      "Write the lesson.\nWrite the AI's mistake.\nKeep it under 250 characters.\nCheck it.",
    );

    expect(material.systemPrompt.split(OUTPUT_FORMAT)[0]).toBe(
      "Write the lesson.\nWrite it from the material.\nKeep it under 250 characters.\nCheck it.",
    );

    expect(sources.systemPrompt.split(OUTPUT_FORMAT)[0]).toBe(
      "Write the lesson.\nWrite it from the sources.\nKeep it under 250 characters.\nCheck it.",
    );

    expect(exam.systemPrompt.split(OUTPUT_FORMAT)[0]).toBe(
      "Write the lesson.\nWrite it for the exams.\nKeep it under 250 characters.\nCheck it.",
    );

    expect(setup.systemPrompt.split(OUTPUT_FORMAT)[0]).toBe(
      "Write the lesson.\nKeep it under 250 characters.\nWrite the setup.\nCheck it.",
    );

    expect(written.systemPrompt.split(OUTPUT_FORMAT)[0]).toBe(
      "Write the lesson.\nKeep it under 250 characters.\nWrite typed answers.\nCheck it.",
    );

    // The schema travels in the system prompt, since no provider but OpenAI takes it as a grammar.
    expect(regular.systemPrompt).toContain('"const":"hookGuess"');

    expect(regular.userPrompt).toContain("\nMONEY: $2,400.00 or $2,400\n");
    expect(regular.userPrompt).not.toContain("TODAY");
    expect(setup.userPrompt).toMatch(/\nTODAY: \d{4}-\d{2}-\d{2}\n/u);

    // Every lesson opens on its story's moment; the guess comes later.
    expect(regular.userPrompt).toContain("1. hook, written as: hookText\n");
    expect(beginnerExam.userPrompt).toContain("1. hook, written as: hookText\n");

    // Only learners whose exams ask written answers may get the application as a typed answer.
    expect(regular.userPrompt).toContain("3. application, written as: check or mathCheck\n");

    expect(written.userPrompt).toContain(
      "3. application, written as: check or mathCheck or typedAnswer\n",
    );
  });

  it("falls back to the chain's other models, each from another family", async () => {
    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({ screens: [], summary: EMPTY_MAP }),
    );

    const params = {
      activityTemplates: [],
      chapterTitle: "Temperature",
      courseTitle: "Weather",
      language: "en",
      level: "beginner",
      spec: spec([screen("hook"), screen("check")]),
    } satisfies Parameters<typeof writeLessonDraft>[0];

    await writeLessonDraft({ ...params, model: "anthropic/claude-sonnet-5.5" });
    const sonnet = vi.mocked(generateText).mock.lastCall?.[0].providerOptions?.gateway;

    await writeLessonDraft(params);
    const terra = vi.mocked(generateText).mock.lastCall?.[0].providerOptions?.gateway;

    expect(sonnet).toMatchObject({ models: ["openai/gpt-6.1-terra", "google/gemini-4-argon"] });

    expect(terra).toMatchObject({
      models: ["anthropic/claude-sonnet-5.5", "google/gemini-4-argon"],
    });
  });

  it("reads a key the model left out as null when null is all it could hold", async () => {
    // Opus 5.5 rewrote a held-back lesson (9 Oct 2026) without strict decoding and left out
    // `picture`; no model writes the lesson under strict decoding now.
    const draft = {
      screens: [
        {
          context: null,
          image: null,
          kind: "check",
          options: [option("White", true), option("Purple", false)],
          question: "What color are the pp seedling's flowers?",
          visual: null,
        },
      ],
      summary: {
        ideas: [{ label: "Recessive alleles", text: "Two recessive alleles show their color." }],
        shape: "hub",
      },
    };

    await answerOnceWith(draft);

    const { data } = await writeLessonDraft({
      activityTemplates: [],
      chapterTitle: "Heredity",
      courseTitle: "Biology",
      language: "en",
      level: "beginner",
      spec: spec([screen("check")]),
    });

    expect(data.screens[0]).toMatchObject({ options: [{ picture: null }, { picture: null }] });
  });

  it("brings a long alt and a guess's extra wrong option within bounds instead of failing", async () => {
    const alt = "word ".repeat(40).trim();

    await answerOnceWith({
      screens: [
        {
          image: { alt, prompt: "A pressure sensor on a pipe." },
          kind: "hookGuess",
          options: [
            { isCorrect: false, text: "A" },
            { isCorrect: true, text: "B" },
            { isCorrect: false, text: "C" },
            { isCorrect: false, text: "D" },
            { isCorrect: false, text: "E" },
          ],
          question: "Which reading do you trust?",
          reveal: "B, because it was calibrated.",
          visual: null,
        },
      ],
      summary: EMPTY_MAP,
    });

    const { data } = await writeLessonDraft({
      activityTemplates: [],
      chapterTitle: "Sensors",
      courseTitle: "Instrumentation",
      language: "en",
      level: "intermediate",
      spec: spec([screen("hook")]),
    });

    expect(data.screens[0]).toMatchObject({
      image: { alt: expect.stringMatching(/^(?:word ){30,}word\u2026$/u) },
      options: [{ text: "A" }, { text: "B" }, { text: "C" }, { text: "D" }],
    });
  });
});
