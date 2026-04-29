import { beforeEach, describe, expect, test, vi } from "vitest";
import { getPracticeImagePrompts } from "../steps/_utils/get-practice-image-prompts";
import { generatePracticeContentStep } from "../steps/generate-practice-content-step";
import { generateStepImagesStep } from "../steps/generate-step-images-step";
import { savePracticeLessonStep } from "../steps/save-practice-lesson-step";
import { createKindWorkflowContext } from "./_test-utils/create-kind-workflow-context";
import { practiceLessonWorkflow } from "./practice-workflow";

const { practiceContent } = vi.hoisted(() => ({
  practiceContent: {
    kind: "practice" as const,
    scenario: {
      imagePrompt: "scenario prompt",
      text: "Scenario text",
      title: "Scenario",
    },
    steps: [
      {
        context: "Question context",
        imagePrompt: "question prompt",
        options: [{ feedback: "yes", isCorrect: true, text: "Answer" }],
        question: "What now?",
      },
    ],
  },
}));

vi.mock("../steps/generate-practice-content-step", () => ({
  generatePracticeContentStep: vi.fn().mockResolvedValue(practiceContent),
}));

vi.mock("../steps/generate-step-images-step", () => ({
  generateStepImagesStep: vi.fn().mockResolvedValue({
    images: [
      { prompt: "scenario prompt", url: "https://example.com/scenario.webp" },
      { prompt: "question prompt", url: "https://example.com/question.webp" },
    ],
  }),
}));

vi.mock("../steps/save-practice-lesson-step", () => ({
  savePracticeLessonStep: vi.fn(),
}));

describe(practiceLessonWorkflow, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("uses practice image prompts before saving practice content", async () => {
    const context = await createKindWorkflowContext();

    await practiceLessonWorkflow(context);

    expect(generatePracticeContentStep).toHaveBeenCalledExactlyOnceWith(context);
    expect(generateStepImagesStep).toHaveBeenCalledExactlyOnceWith({
      context,
      preset: "practice",
      prompts: getPracticeImagePrompts(practiceContent),
    });
    expect(savePracticeLessonStep).toHaveBeenCalledWith(
      expect.objectContaining({ content: practiceContent, context, images: expect.any(Array) }),
    );
  });
});
