import { generateText } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { type LessonScreen, type LessonSpec } from "../lesson-spec/lesson-spec-rules";
import { getLessonRewriteModel, writeLessonDraft } from "./lesson-writer";
import type * as Ai from "ai";

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
    "Keep it short.",
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
  return { activityTemplate, brief: kind, kind, skills: [0], visual: null };
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
    supportMode: "explanationFirst",
    title: "Temperatures below zero",
  };
}

function option(text: string, isCorrect: boolean) {
  return { isCorrect, reason: "Why.", text };
}

describe(getLessonRewriteModel, () => {
  it("picks the writer chain's first model from a family whose drafts weren't held back", () => {
    expect(getLessonRewriteModel(["openai/gpt-6-sol", "openai/gpt-6-sol"])).toBe(
      "anthropic/claude-opus-5.5",
    );

    expect(getLessonRewriteModel(["google/gemini-3.8-flash", "google/gemini-3.8-flash"])).toBe(
      "openai/gpt-6-sol",
    );

    // A fallback wrote one of them: both families are left out.
    expect(getLessonRewriteModel(["openai/gpt-6-sol", "anthropic/claude-opus-5.5"])).toBe(
      "google/gemini-3.8-flash",
    );
  });
});

describe(writeLessonDraft, () => {
  it("keeps only its own variants' rules, in place, and the date only for setup", async () => {
    vi.mocked(generateText).mockResolvedValue(createGenerateTextResult({ screens: [] }));

    const params = {
      activityTemplates: [],
      chapterTitle: "Temperature",
      courseTitle: "Weather",
      language: "en",
      level: "beginner",
      spec: spec([screen("hook"), screen("explanation"), screen("application")]),
    } satisfies Parameters<typeof writeLessonDraft>[0];

    const findError = spec([screen("hook"), screen("activity", "findError")]);
    const exams = [{ name: "ENEM", style: "Multiple choice with a text." }];

    const [regular, spotAi, material, sources, exam, setup, written] = await Promise.all([
      writeLessonDraft(params),
      writeLessonDraft({ ...params, spec: findError }),
      writeLessonDraft({ ...params, exams: [], material: "<page>Slides</page>" }),
      writeLessonDraft({ ...params, sources: "<page>Law</page>" }),
      writeLessonDraft({ ...params, exams }),
      writeLessonDraft({ ...params, setup: true }),
      writeLessonDraft({ ...params, shortAnswers: true }),
    ]);

    expect(regular.systemPrompt).toBe("Write the lesson.\nKeep it short.\nCheck it.");

    expect(spotAi.systemPrompt).toBe(
      "Write the lesson.\nWrite the AI's mistake.\nKeep it short.\nCheck it.",
    );

    expect(material.systemPrompt).toBe(
      "Write the lesson.\nWrite it from the material.\nKeep it short.\nCheck it.",
    );

    expect(sources.systemPrompt).toBe(
      "Write the lesson.\nWrite it from the sources.\nKeep it short.\nCheck it.",
    );

    expect(exam.systemPrompt).toBe(
      "Write the lesson.\nWrite it for the exams.\nKeep it short.\nCheck it.",
    );

    expect(setup.systemPrompt).toBe(
      "Write the lesson.\nKeep it short.\nWrite the setup.\nCheck it.",
    );

    expect(written.systemPrompt).toBe(
      "Write the lesson.\nKeep it short.\nWrite typed answers.\nCheck it.",
    );

    expect(regular.userPrompt).not.toContain("TODAY");
    expect(setup.userPrompt).toMatch(/\nTODAY: \d{4}-\d{2}-\d{2}\n/u);

    // Only learners whose exams ask written answers may get the application as a typed answer.
    expect(regular.userPrompt).toContain("3. application, written as: check or mathCheck\n");

    expect(written.userPrompt).toContain(
      "3. application, written as: check or mathCheck or typedAnswer\n",
    );
  });

  it("falls back from Gemini to Sol before Opus", async () => {
    vi.mocked(generateText).mockResolvedValue(createGenerateTextResult({ screens: [] }));

    const params = {
      activityTemplates: [],
      chapterTitle: "Temperature",
      courseTitle: "Weather",
      language: "en",
      level: "beginner",
      spec: spec([screen("hook"), screen("check")]),
    } satisfies Parameters<typeof writeLessonDraft>[0];

    await writeLessonDraft({ ...params, model: "google/gemini-3.8-flash" });
    const gemini = vi.mocked(generateText).mock.lastCall?.[0].providerOptions?.gateway;

    await writeLessonDraft(params);
    const sol = vi.mocked(generateText).mock.lastCall?.[0].providerOptions?.gateway;

    expect(gemini).toMatchObject({ models: ["openai/gpt-6-sol", "anthropic/claude-opus-5.5"] });
    expect(sol).toMatchObject({ models: ["anthropic/claude-opus-5.5", "google/gemini-3.8-flash"] });
  });

  it("reads a key the model left out as null when null is all it could hold", async () => {
    // Opus 5.5 rewrote a held-back lesson (9 Oct 2026) without strict decoding, since the writer's
    // schema has more nullable fields than Anthropic's strict mode takes, and left out `picture`.
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
      summary: ["Two recessive alleles show their color."],
    };

    const model = new MockLanguageModelV4({
      doGenerate: {
        content: [{ text: JSON.stringify(draft), type: "text" }],
        finishReason: { raw: "end_turn", unified: "stop" },
        usage: {
          inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 10, total: 10 },
          outputTokens: { reasoning: 0, text: 10, total: 10 },
        },
        warnings: [],
      },
    });

    const { generateText: actualGenerateText } = await vi.importActual<typeof Ai>("ai");

    vi.mocked(generateText).mockImplementationOnce((options) =>
      actualGenerateText({ ...options, model }),
    );

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
});
