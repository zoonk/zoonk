import { generateLessonQuiz } from "@zoonk/ai/tasks/lessons/core/quiz";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import {
  createCompletedExplanation,
  createLessonContext,
} from "./_test-utils/create-lesson-context";
import { generateQuizContentStep } from "./generate-quiz-content-step";

vi.mock("@zoonk/ai/tasks/lessons/core/quiz", () => ({
  generateLessonQuiz: vi.fn().mockResolvedValue({
    data: {
      questions: [
        {
          context: "Question context",
          format: "multipleChoice",
          options: [{ feedback: "yes", isCorrect: true, text: "Apply it" }],
          question: "What is true?",
        },
      ],
    },
  }),
}));

describe(generateQuizContentStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("uses only explanation steps since the previous quiz", async () => {
    const context = await createLessonContext({ kind: "quiz", organizationId, position: 4 });

    await Promise.all([
      createCompletedExplanation({
        chapterId: context.chapterId,
        organizationId,
        position: 0,
        text: "Old quiz explanation",
        title: "Old",
      }),
      lessonFixture({
        chapterId: context.chapterId,
        generationStatus: "completed",
        isPublished: true,
        kind: "quiz",
        organizationId,
        position: 1,
      }),
      createCompletedExplanation({
        chapterId: context.chapterId,
        organizationId,
        position: 2,
        text: "New quiz explanation",
        title: "New",
      }),
    ]);

    const result = await generateQuizContentStep(context);

    expect(result.kind).toBe("quiz");
    expect(generateLessonQuiz).toHaveBeenCalledWith(
      expect.objectContaining({
        explanationSteps: [{ text: "New quiz explanation", title: "New" }],
      }),
    );
  });
});
