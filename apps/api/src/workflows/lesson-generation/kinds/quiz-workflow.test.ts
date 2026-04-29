import { generateLessonQuiz } from "@zoonk/ai/tasks/lessons/core/quiz";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { generateStepImage } from "@zoonk/core/steps/image";
import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import {
  createCompletedExplanation,
  createLessonContext,
} from "../steps/_test-utils/create-lesson-context";
import { quizLessonWorkflow } from "./quiz-workflow";

vi.mock("@zoonk/ai/tasks/lessons/core/quiz", () => ({
  generateLessonQuiz: vi.fn().mockResolvedValue({
    data: {
      questions: [
        {
          format: "selectImage",
          options: [
            { feedback: "Correct", isCorrect: true, prompt: "correct image" },
            { feedback: "Not yet", isCorrect: false, prompt: "wrong image" },
          ],
          question: "Pick one",
        },
      ],
    },
  }),
}));

vi.mock("@zoonk/core/steps/image", () => ({
  generateStepImage: vi.fn().mockImplementation(({ prompt }) =>
    Promise.resolve({
      data: `https://example.com/${encodeURIComponent(prompt)}.webp`,
      error: null,
    }),
  ),
}));

describe(quizLessonWorkflow, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("stores quiz image questions from the uncovered explanation steps", async () => {
    const context = await createLessonContext({ kind: "quiz", organizationId, position: 2 });

    await createCompletedExplanation({
      chapterId: context.chapterId,
      organizationId,
      position: 1,
      text: "Use the quiz explanation.",
      title: "Quiz Source",
    });

    await quizLessonWorkflow(context);

    expect(generateLessonQuiz).toHaveBeenCalledWith(
      expect.objectContaining({
        explanationSteps: [{ text: "Use the quiz explanation.", title: "Quiz Source" }],
      }),
    );

    expect(generateStepImage).toHaveBeenCalledTimes(2);

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: context.id },
    });

    const content = parseStepContent("selectImage", steps[0]?.content);

    expect(steps.map((step) => [step.position, step.kind])).toEqual([[0, "selectImage"]]);
    expect(content.question).toBe("Pick one");

    expect(content.options).toEqual([
      expect.objectContaining({
        feedback: "Correct",
        isCorrect: true,
        url: "https://example.com/correct%20image.webp",
      }),
      expect.objectContaining({
        feedback: "Not yet",
        isCorrect: false,
        url: "https://example.com/wrong%20image.webp",
      }),
    ]);
  });
});
