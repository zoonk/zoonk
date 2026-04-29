import { beforeEach, describe, expect, test, vi } from "vitest";
import { generateQuizContentStep } from "../steps/generate-quiz-content-step";
import { generateQuizImagesStep } from "../steps/generate-quiz-images-step";
import { saveQuizLessonStep } from "../steps/save-quiz-lesson-step";
import { createKindWorkflowContext } from "./_test-utils/create-kind-workflow-context";
import { quizLessonWorkflow } from "./quiz-workflow";

const { quizQuestions } = vi.hoisted(() => ({
  quizQuestions: [
    {
      context: "Question context",
      format: "multipleChoice" as const,
      options: [{ feedback: "yes", isCorrect: true, text: "Answer" }],
      question: "Pick one",
    },
  ],
}));

vi.mock("../steps/generate-quiz-content-step", () => ({
  generateQuizContentStep: vi.fn().mockResolvedValue({
    kind: "quiz",
    questions: quizQuestions,
  }),
}));

vi.mock("../steps/generate-quiz-images-step", () => ({
  generateQuizImagesStep: vi.fn().mockResolvedValue(quizQuestions),
}));

vi.mock("../steps/save-quiz-lesson-step", () => ({
  saveQuizLessonStep: vi.fn(),
}));

describe(quizLessonWorkflow, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("adds quiz option image URLs before saving quiz content", async () => {
    const context = await createKindWorkflowContext();

    await quizLessonWorkflow(context);

    expect(generateQuizContentStep).toHaveBeenCalledExactlyOnceWith(context);
    expect(generateQuizImagesStep).toHaveBeenCalledExactlyOnceWith({
      context,
      questions: quizQuestions,
    });
    expect(saveQuizLessonStep).toHaveBeenCalledWith({
      context,
      questions: quizQuestions,
    });
  });
});
