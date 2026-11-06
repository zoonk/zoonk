import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import {
  type GenerateLessonQuestionAnswerParams,
  generateLessonQuestionAnswer,
} from "./lesson-question";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./lesson-question.prompt.md", () => ({ default: "Tutor the learner." }));

vi.mock("./lesson-question-lesson.prompt.md", () => ({
  default:
    "{{#questionScreen}}Hint, never reveal.{{/questionScreen}}{{#teachingScreen}}Answer directly.{{/teachingScreen}}",
}));

vi.mock("./lesson-question-beyond.prompt.md", () => ({ default: "Beyond a lesson." }));
vi.mock("./lesson-question-chapter.prompt.md", () => ({ default: "Chapter rules." }));
vi.mock("./lesson-question-mock.prompt.md", () => ({ default: "Mock rules." }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
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

function lessonSnapshot(kind: "answer" | "lesson" | "step", answerable = true): Snapshot {
  const step = {
    answerable,
    content: {},
    kind: "check",
    sentence: null,
    stepNumber: 1,
    word: null,
  };

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

  it("sends each scope only its own rules after the shared ones", async () => {
    await expect(getInstructions(lessonSnapshot("step"))).resolves.toBe(
      "Tutor the learner.\nHint, never reveal.",
    );

    await expect(getInstructions(lessonSnapshot("answer"))).resolves.toBe(
      "Tutor the learner.\nHint, never reveal.",
    );

    await expect(getInstructions(lessonSnapshot("step", false))).resolves.toBe(
      "Tutor the learner.\nAnswer directly.",
    );

    await expect(getInstructions(CHAPTER)).resolves.toBe(
      "Tutor the learner.\nBeyond a lesson.\nChapter rules.",
    );

    await expect(getInstructions(MOCK)).resolves.toBe(
      "Tutor the learner.\nBeyond a lesson.\nMock rules.",
    );
  });
});
