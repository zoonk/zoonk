import { generateText, streamText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import {
  type GenerateLessonQuestionAnswerParams,
  generateLessonQuestionAnswer,
  streamLessonQuestionAnswer,
} from "./lesson-question";
import { type LessonScopeContext } from "./lesson-question-context";
import type * as Ai from "ai";

vi.mock("../_utils/address-form.prompt.md", () => ({
  default:
    "{{#neutral}}Neutral address.{{/neutral}}{{#feminine}}Feminine address.{{/feminine}}{{#masculine}}Masculine address.{{/masculine}}",
}));

vi.mock("server-only", () => ({}));
vi.mock("../tutor/learner-needs.prompt.md", () => ({ default: "Learner needs rules." }));
vi.mock("./lesson-question.prompt.md", () => ({ default: "Tutor in {{LEARNER_LANGUAGE}}." }));

vi.mock("./lesson-question-lesson.prompt.md", () => ({
  default:
    "{{#questionScreen}}Hint, never reveal.{{/questionScreen}}{{#teachingScreen}}Answer directly.{{/teachingScreen}}",
}));

vi.mock("./lesson-screen-rules.prompt.md", () => ({
  default: "{{#guessScreen}}Hint until it's revealed.{{/guessScreen}}Weigh their reasoning.",
}));

vi.mock("./lesson-question-beyond.prompt.md", () => ({ default: "Beyond a lesson." }));
vi.mock("./lesson-question-chapter.prompt.md", () => ({ default: "Chapter rules." }));
vi.mock("./lesson-question-mock.prompt.md", () => ({ default: "Mock rules." }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn(), streamText: vi.fn() };
});

type Snapshot = GenerateLessonQuestionAnswerParams["contextSnapshot"];

const CHAPTER = {
  chapter: { description: "Powers.", level: "beginner", objectives: [], title: "Exponents" },
  course: null,
  language: "en",
  lessons: [],
  scope: { kind: "chapter" },
  version: 1,
} satisfies Snapshot;

const MOCK = {
  areas: [],
  exam: {
    date: "2026-10-01",
    fullLength: true,
    name: "ENEM",
    number: 1,
    scoring: "raw",
    scoringNote: null,
  },
  language: "en",
  missed: [],
  mistakeCauses: [],
  result: null,
  scope: { kind: "mock" },
  sections: [],
  version: 1,
} satisfies Snapshot;

const CHECK_SCREEN = { content: {}, kind: "check" };

function lessonSnapshot(
  kind: "answer" | "lesson" | "step",
  answerable = true,
  screen: { content: object; kind: string } = CHECK_SCREEN,
): LessonScopeContext {
  const step = { answerable, ...screen, sentence: null, stepNumber: 1, word: null };

  return {
    answer: null,
    chapter: { description: null, title: "Orbits" },
    course: { description: null, language: "en", targetLanguage: null, title: "Physics" },
    lesson: { description: null, kind: "explanation", language: "en", title: "Orbits" },
    lessonSteps: [step],
    scope: { kind },
    step: kind === "lesson" ? null : step,
    version: 1,
  };
}

async function getInstructions(contextSnapshot: Snapshot): Promise<string> {
  const { systemPrompt } = await generateLessonQuestionAnswer({
    contextSnapshot,
    priorTurns: [],
    question: "Why?",
  });

  expect(vi.mocked(generateText).mock.lastCall?.[0].instructions).toBe(systemPrompt);
  return systemPrompt;
}

describe(generateLessonQuestionAnswer, () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(generateText).mockResolvedValue({
      ...createGenerateTextResult(null, "openai/gpt-6-luna"),
      text: "Because.",
    });
  });

  it("keeps needs out of the recorded prompt version", async () => {
    const input = { contextSnapshot: lessonSnapshot("step"), priorTurns: [], question: "Why?" };
    const ordinary = await generateLessonQuestionAnswer(input);

    const personal = await generateLessonQuestionAnswer({
      ...input,
      addressForm: "feminine",
      learnerNeeds: { note: null, variants: ["adhd"] },
    });

    expect(personal.systemPrompt).not.toBe(ordinary.systemPrompt);
    expect(personal.provenance.promptVersion).toBe(ordinary.provenance.promptVersion);
  });

  it("keeps needs out of the streamed answer's prompt version", async () => {
    const result = createGenerateTextResult(null, "openai/gpt-6-luna");

    vi.mocked(streamText).mockReturnValue({
      finalStep: Promise.resolve(result.finalStep),
      steps: Promise.resolve(result.steps),
    } as never);

    const input = { contextSnapshot: lessonSnapshot("step"), priorTurns: [], question: "Why?" };
    const ordinary = streamLessonQuestionAnswer(input);

    const personal = streamLessonQuestionAnswer({
      ...input,
      addressForm: "feminine",
      learnerNeeds: { note: null, variants: ["adhd"] },
    });

    const [first, second] = await Promise.all([ordinary.provenance, personal.provenance]);
    expect(second.promptVersion).toBe(first.promptVersion);
    const calls = vi.mocked(streamText).mock.calls;
    expect(calls[0]?.[0].instructions).not.toBe(calls[1]?.[0].instructions);
  });

  it("sends each scope only its own rules after the shared ones", async () => {
    await expect(getInstructions(lessonSnapshot("step"))).resolves.toBe(
      "Tutor in US English.\nHint, never reveal.\nWeigh their reasoning.\nNeutral address.",
    );

    await expect(getInstructions(lessonSnapshot("answer"))).resolves.toBe(
      "Tutor in US English.\nHint, never reveal.\nWeigh their reasoning.\nNeutral address.",
    );

    await expect(getInstructions(lessonSnapshot("lesson"))).resolves.toBe(
      "Tutor in US English.\nHint, never reveal.\nWeigh their reasoning.\nNeutral address.",
    );

    await expect(getInstructions(lessonSnapshot("step", false))).resolves.toBe(
      "Tutor in US English.\nAnswer directly.\nWeigh their reasoning.\nNeutral address.",
    );

    const guess = { content: { variant: "guess" }, kind: "hook" };

    await expect(getInstructions(lessonSnapshot("step", false, guess))).resolves.toBe(
      "Tutor in US English.\n\nHint until it's revealed.Weigh their reasoning.\nNeutral address.",
    );

    await expect(getInstructions(CHAPTER)).resolves.toBe(
      "Tutor in US English.\nBeyond a lesson.\nChapter rules.\nNeutral address.",
    );

    await expect(getInstructions(MOCK)).resolves.toBe(
      "Tutor in US English.\nBeyond a lesson.\nMock rules.\nNeutral address.",
    );
  });

  it("names the course's language as the answer's", async () => {
    const snapshot = lessonSnapshot("answer");

    await expect(
      getInstructions({
        ...snapshot,
        course: { ...snapshot.course, language: "pt", targetLanguage: "it", title: "Italiano" },
      }),
    ).resolves.toBe(
      "Tutor in Português Brasileiro.\nHint, never reveal.\nWeigh their reasoning.\nNeutral address.",
    );
  });
});
