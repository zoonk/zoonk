import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateStepImagePrompts } from "./step-image-prompts";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./step-image-prompts.prompt.md", () => ({ default: "Select an instructional image" }));

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof Ai>()),
  generateText: vi.fn(),
}));

const input = {
  chapterTitle: "Clear explanations",
  courseTitle: "Communication",
  language: "en",
  lessonDescription: "Explain the goal first",
  lessonTitle: "Goal before rules",
  steps: [
    { text: "Say what success means", title: "Goal" },
    { text: "Collect three tokens", title: "Example" },
  ],
};

describe(generateStepImagePrompts, () => {
  beforeEach(() => vi.clearAllMocks());

  it("discards a private illustration when the actual lesson has no visual need", async () => {
    vi.mocked(generateText).mockResolvedValue({
      output: {
        images: [{ prompt: "Three tokens", stepIndex: 1 }],
        visualLearningGoal: "Use clear wording",
        visualNeed: "none",
      },
      usage: {},
    } as Awaited<ReturnType<typeof generateText>>);

    const result = await generateStepImagePrompts({
      ...input,
      imageMode: "instructional",
      model: "openai/gpt-5.6-luna",
      useFallback: false,
    });

    expect(result.data.images).toStrictEqual([]);
  });

  it("preserves the selected step index for a useful illustration", async () => {
    const selected = {
      alt: "Three tokens form a row.",
      prompt: "A simple physical arrangement",
      stepIndex: 1,
    };

    vi.mocked(generateText).mockResolvedValue({
      output: {
        images: [selected],
        visualLearningGoal: "Recognize the arrangement",
        visualNeed: "spatial",
      },
      usage: {},
    } as Awaited<ReturnType<typeof generateText>>);

    const result = await generateStepImagePrompts({ ...input, imageMode: "instructional" });
    expect(result.data.images).toStrictEqual([selected]);
  });
});
