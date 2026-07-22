import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateLessonPractice } from "./lesson-practice";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("./lesson-practice.prompt.md", () => ({ default: "{{FEEDBACK}}" }));
vi.mock("../_utils/lesson-feedback.prompt.md", () => ({ default: "Feedback guidance" }));
vi.mock("../_utils/lesson-rich-text.prompt.md", () => ({ default: "Rich text guidance" }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();

  return { ...actual, generateText: vi.fn() };
});

describe(generateLessonPractice, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes blank and duplicate options from generated practice situations", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      output: {
        situations: [
          {
            dialogue: "Apply the contract rule.",
            imagePrompt: "A rental contract beside a broken pipe.",
            options: [
              { feedback: "Correct.", isCorrect: true, text: "Contact the owner" },
              { feedback: "Not supported.", isCorrect: false, text: "Charge the tenant" },
              { feedback: "Not supported.", isCorrect: false, text: "Split the cost" },
              { feedback: "Not supported.", isCorrect: false, text: "Ignore the clause" },
              { feedback: "Also correct.", isCorrect: true, text: "Contact the owner" },
            ],
            question: "Who should arrange the repair?",
          },
          {
            dialogue: "Give the robot a precise instruction.",
            imagePrompt: "A robot beside labeled shelves.",
            options: [
              { feedback: "Correct.", isCorrect: true, text: "Match labels" },
              { feedback: "Too vague.", isCorrect: false, text: "Make it neat" },
              { feedback: "Too vague.", isCorrect: false, text: "Use common sense" },
              { feedback: "Too vague.", isCorrect: false, text: "Make it look right" },
              { feedback: "", isCorrect: false, text: "   " },
            ],
            question: "Which instruction is precise?",
          },
        ],
      },
      usage: {},
    } as Awaited<ReturnType<typeof generateText>>);

    const result = await generateLessonPractice({
      chapterTitle: "Rules",
      courseTitle: "Reasoning",
      language: "en",
      lesson: { description: "Apply explicit rules.", title: "Using rules" },
    });

    expect(result.data.situations.map((situation) => situation.options)).toStrictEqual([
      [
        { feedback: "Correct.", isCorrect: true, text: "Contact the owner" },
        { feedback: "Not supported.", isCorrect: false, text: "Charge the tenant" },
        { feedback: "Not supported.", isCorrect: false, text: "Split the cost" },
        { feedback: "Not supported.", isCorrect: false, text: "Ignore the clause" },
      ],
      [
        { feedback: "Correct.", isCorrect: true, text: "Match labels" },
        { feedback: "Too vague.", isCorrect: false, text: "Make it neat" },
        { feedback: "Too vague.", isCorrect: false, text: "Use common sense" },
        { feedback: "Too vague.", isCorrect: false, text: "Make it look right" },
      ],
    ]);
  });

  it("keeps the correct answer when limiting extra distinct options", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      output: {
        situations: [
          {
            dialogue: "Choose the precise instruction.",
            imagePrompt: "A robot beside labeled shelves.",
            options: [
              { feedback: "Too vague.", isCorrect: false, text: "Make it neat" },
              { feedback: "Too vague.", isCorrect: false, text: "Use common sense" },
              { feedback: "Too vague.", isCorrect: false, text: "Make it look right" },
              { feedback: "Too vague.", isCorrect: false, text: "Put them away" },
              { feedback: "Correct.", isCorrect: true, text: "Match the labels" },
            ],
            question: "Which instruction can the robot follow?",
          },
        ],
      },
      usage: {},
    } as Awaited<ReturnType<typeof generateText>>);

    const result = await generateLessonPractice({
      chapterTitle: "Algorithms",
      courseTitle: "Computer Science",
      language: "en",
      lesson: { description: "Write precise instructions.", title: "Algorithms" },
    });

    expect(result.data.situations[0]?.options).toStrictEqual([
      { feedback: "Too vague.", isCorrect: false, text: "Make it neat" },
      { feedback: "Too vague.", isCorrect: false, text: "Use common sense" },
      { feedback: "Too vague.", isCorrect: false, text: "Make it look right" },
      { feedback: "Correct.", isCorrect: true, text: "Match the labels" },
    ]);
  });
});
