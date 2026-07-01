import { generateLessonPractice } from "@zoonk/ai/tasks/lessons/core/practice";
import { generateContentStepImage } from "@zoonk/core/steps/content-image";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCompletedExplanation,
  createLessonContext,
} from "../steps/_test-utils/create-lesson-context";
import { practiceLessonWorkflow } from "./practice-workflow";

vi.mock("@zoonk/ai/tasks/lessons/core/practice", () => ({
  generateLessonPractice: vi.fn().mockResolvedValue({
    data: {
      situations: [
        {
          dialogue: "Question context",
          imagePrompt: "question prompt",
          options: [
            { feedback: "Correct", isCorrect: true, text: "Answer" },
            { feedback: "Not yet", isCorrect: false, text: "Distractor" },
          ],
          question: "What now?",
        },
      ],
    },
  }),
}));

vi.mock("@zoonk/core/steps/content-image", () => ({
  generateContentStepImage: vi
    .fn()
    .mockImplementation(({ prompt }) =>
      Promise.resolve({
        data: `https://example.com/${encodeURIComponent(prompt)}.webp`,
        error: null,
      }),
    ),
}));

describe(practiceLessonWorkflow, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores practice questions from the previous explanation", async () => {
    const context = await createLessonContext({ kind: "practice", organizationId, position: 2 });

    await createCompletedExplanation({
      chapterId: context.chapterId,
      organizationId,
      position: 1,
      text: "Use the latest explanation.",
      title: "Latest",
    });

    await practiceLessonWorkflow(context);

    expect(generateLessonPractice).toHaveBeenCalledWith(
      expect.objectContaining({
        lesson: { description: "Use the latest explanation.", title: "Latest" },
      }),
    );

    expect(generateContentStepImage).toHaveBeenCalledOnce();

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: context.id },
    });

    const question = parseStepContent("multipleChoice", steps[0]?.content);

    expect(steps.map((step) => [step.position, step.kind])).toStrictEqual([[0, "multipleChoice"]]);

    expect(question).toMatchObject({
      context: "Question context",
      image: { prompt: "question prompt", url: "https://example.com/question%20prompt.webp" },
      question: "What now?",
    });

    expect(question.options).toStrictEqual([
      expect.objectContaining({ feedback: "Correct", isCorrect: true, text: "Answer" }),
      expect.objectContaining({ feedback: "Not yet", isCorrect: false, text: "Distractor" }),
    ]);
  });
});
