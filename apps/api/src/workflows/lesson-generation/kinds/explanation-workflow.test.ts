import { beforeEach, describe, expect, test, vi } from "vitest";
import { generateExplanationContentStep } from "../steps/generate-explanation-content-step";
import { generateImagePromptsStep } from "../steps/generate-image-prompts-step";
import { generateStepImagesStep } from "../steps/generate-step-images-step";
import { saveExplanationLessonStep } from "../steps/save-static-lesson-step";
import { createKindWorkflowContext } from "./_test-utils/create-kind-workflow-context";
import { explanationLessonWorkflow } from "./explanation-workflow";

vi.mock("../steps/generate-explanation-content-step", () => ({
  generateExplanationContentStep: vi.fn().mockResolvedValue({
    steps: [
      { text: "Explain A", title: "A" },
      { text: "Explain B", title: "B" },
    ],
  }),
}));

vi.mock("../steps/generate-image-prompts-step", () => ({
  generateImagePromptsStep: vi.fn().mockResolvedValue({
    prompts: ["image prompt a", "image prompt b"],
  }),
}));

vi.mock("../steps/generate-step-images-step", () => ({
  generateStepImagesStep: vi.fn().mockResolvedValue({
    images: [
      { prompt: "image prompt a", url: "https://example.com/a.webp" },
      { prompt: "image prompt b", url: "https://example.com/b.webp" },
    ],
  }),
}));

vi.mock("../steps/save-static-lesson-step", () => ({
  saveExplanationLessonStep: vi.fn(),
}));

describe(explanationLessonWorkflow, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("generates explanation content, images, and saves the static lesson", async () => {
    const context = await createKindWorkflowContext();

    await explanationLessonWorkflow(context);

    expect(generateExplanationContentStep).toHaveBeenCalledExactlyOnceWith(context);
    expect(generateImagePromptsStep).toHaveBeenCalledExactlyOnceWith({
      context,
      steps: [
        { text: "Explain A", title: "A" },
        { text: "Explain B", title: "B" },
      ],
    });
    expect(generateStepImagesStep).toHaveBeenCalledExactlyOnceWith({
      context,
      prompts: ["image prompt a", "image prompt b"],
    });
    expect(saveExplanationLessonStep).toHaveBeenCalledExactlyOnceWith({
      context,
      images: [
        { prompt: "image prompt a", url: "https://example.com/a.webp" },
        { prompt: "image prompt b", url: "https://example.com/b.webp" },
      ],
      steps: [
        { text: "Explain A", title: "A" },
        { text: "Explain B", title: "B" },
      ],
    });
  });
});
