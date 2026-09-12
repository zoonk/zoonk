import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateCourseCurriculumLevel } from "./course-curriculum";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./course-curriculum.prompt.md", () => ({ default: "Curriculum" }));

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof Ai>()),
  generateText: vi.fn(),
}));

const input = {
  courseTitle: "Computer Science",
  format: "core" as const,
  language: "en",
  level: "advanced" as const,
  targetLanguage: null,
};

function respond(count: number) {
  vi.mocked(generateText).mockResolvedValueOnce({
    output: {
      chapters: Array.from({ length: count }, (_, index) => ({
        description: `Teach capability ${index}`,
        key: `chapter-${index}`,
        outcomes: [`Use capability ${index}`],
        prerequisiteKeys: index ? [`chapter-${index - 1}`] : [],
        title: `Distinct capability ${index}`,
      })),
    },
    usage: {},
  } as Awaited<ReturnType<typeof generateText>>);
}

describe(generateCourseCurriculumLevel, () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not cap the number of chapters in a complete advanced segment", async () => {
    respond(201);
    const result = await generateCourseCurriculumLevel(input);
    expect(result.data.chapters).toHaveLength(201);
    expect(result.data.chapters.every((chapter) => chapter.level === "advanced")).toBe(true);
  });

  it("keeps the deliberate overview and question boundaries", async () => {
    respond(7);

    await expect(generateCourseCurriculumLevel({ ...input, level: "overview" })).rejects.toThrow(
      "three to six",
    );

    respond(2);

    await expect(
      generateCourseCurriculumLevel({ ...input, format: "question", level: null }),
    ).rejects.toThrow("exactly one");
  });

  it("rejects private context before making a reusable model request", async () => {
    await expect(
      generateCourseCurriculumLevel({
        ...input,
        brief: {
          description: "Fictional",
          learningGoal: "An invented task",
          requirements: [],
          startingKnowledge: "New",
          title: "Synthetic",
        },
      }),
    ).rejects.toThrow("Private learner context");

    expect(generateText).not.toHaveBeenCalled();
  });

  it("uses luna without expensive fallback for an owner-specific brief", async () => {
    respond(1);

    await generateCourseCurriculumLevel({
      ...input,
      brief: {
        description: "Fictional",
        learningGoal: "An invented task",
        requirements: [],
        startingKnowledge: "New",
        title: "Synthetic",
      },
      format: "personalized",
      level: null,
    });

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "openai/gpt-5.6-luna",
        providerOptions: { gateway: { models: [], order: expect.any(Array) } },
      }),
    );
  });
});
