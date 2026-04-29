import { generateLessonPractice } from "@zoonk/ai/tasks/lessons/core/practice";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import {
  createCompletedExplanation,
  createLessonContext,
} from "./_test-utils/create-lesson-context";
import { generatePracticeContentStep } from "./generate-practice-content-step";

vi.mock("@zoonk/ai/tasks/lessons/core/practice", () => ({
  generateLessonPractice: vi.fn().mockResolvedValue({
    data: {
      scenario: { imagePrompt: "scenario prompt", text: "Scenario", title: "Scenario" },
      steps: [
        {
          context: "Use the explanation.",
          imagePrompt: "question prompt",
          options: [{ feedback: "yes", isCorrect: true, text: "Apply it" }],
          question: "What should happen?",
        },
      ],
    },
  }),
}));

describe(generatePracticeContentStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("uses only explanation steps since the previous practice", async () => {
    const context = await createLessonContext({ kind: "practice", organizationId, position: 4 });

    await createCompletedExplanation({
      chapterId: context.chapterId,
      organizationId,
      position: 0,
      text: "Old explanation",
      title: "Old",
    });
    await lessonFixture({
      chapterId: context.chapterId,
      generationStatus: "completed",
      isPublished: true,
      kind: "practice",
      organizationId,
      position: 1,
    });
    await createCompletedExplanation({
      chapterId: context.chapterId,
      organizationId,
      position: 2,
      text: "New explanation",
      title: "New",
    });

    const result = await generatePracticeContentStep(context);

    expect(result.kind).toBe("practice");
    expect(generateLessonPractice).toHaveBeenCalledWith(
      expect.objectContaining({
        explanationSteps: [{ text: "New explanation", title: "New" }],
      }),
    );
  });

  test("throws when practice has no completed explanation source steps", async () => {
    const context = await createLessonContext({ kind: "practice", organizationId });

    await expect(generatePracticeContentStep(context)).rejects.toThrow(
      "Practice generation needs completed explanation lessons",
    );
  });
});
