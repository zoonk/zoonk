import { describe, expect, test, vi } from "vitest";
import { generateActivityStepImagesStep } from "./generate-activity-step-images-step";
import { type LessonActivity } from "./get-lesson-activities-step";

const { generateStepImagesMock, statusMock } = vi.hoisted(() => ({
  generateStepImagesMock: vi.fn(),
  statusMock: vi.fn().mockImplementation(async () => {}),
}));

vi.mock("@/workflows/_shared/stream-status", () => ({
  createEntityStepStream: vi.fn().mockImplementation(() => ({
    [Symbol.asyncDispose]: vi.fn().mockImplementation(async () => {}),
    error: vi.fn().mockImplementation(async () => {}),
    status: statusMock,
  })),
}));

vi.mock("./_utils/generate-step-images", () => ({
  generateStepImages: generateStepImagesMock,
}));

function makeActivity(kind: LessonActivity["kind"]): LessonActivity {
  return {
    id: "activity-1",
    kind,
    language: "pt",
    lesson: {
      chapter: {
        course: {
          organization: {
            slug: "ai-org",
          },
        },
      },
    },
  } as LessonActivity;
}

describe(generateActivityStepImagesStep, () => {
  test("uses the practice image preset for practice activities", async () => {
    generateStepImagesMock.mockResolvedValueOnce([
      { prompt: "Prompt 1", url: "https://example.com/practice.webp" },
    ]);

    const result = await generateActivityStepImagesStep(makeActivity("practice"), ["Prompt 1"]);

    expect(result).toEqual({
      images: [{ prompt: "Prompt 1", url: "https://example.com/practice.webp" }],
    });
    expect(generateStepImagesMock).toHaveBeenCalledWith({
      language: "pt",
      orgSlug: "ai-org",
      preset: "practice",
      prompts: ["Prompt 1"],
    });
  });

  test("uses the illustration preset for non-practice activities", async () => {
    generateStepImagesMock.mockResolvedValueOnce([
      { prompt: "Prompt 1", url: "https://example.com/illustration.webp" },
    ]);

    await generateActivityStepImagesStep(makeActivity("explanation"), ["Prompt 1"]);

    expect(generateStepImagesMock).toHaveBeenCalledWith({
      language: "pt",
      orgSlug: "ai-org",
      preset: "illustration",
      prompts: ["Prompt 1"],
    });
  });
});
