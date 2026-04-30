import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, it } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { saveQuizLessonStep } from "./save-quiz-lesson-step";

describe(saveQuizLessonStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("saves quiz questions with player-ready option ids", async () => {
    const context = await createLessonContext({ kind: "quiz", organizationId });

    await saveQuizLessonStep({
      context,
      questions: [
        {
          context: "Look at the rule.",
          format: "multipleChoice",
          options: [
            { feedback: "Correct!", isCorrect: true, text: "It transfers" },
            { feedback: "Not quite.", isCorrect: false, text: "It only applies here" },
          ],
          question: "What is true?",
        },
        {
          format: "selectImage",
          options: [
            {
              feedback: "Correct!",
              isCorrect: true,
              prompt: "Correct image",
              url: "https://example.com/correct.webp",
            },
            { feedback: "No.", isCorrect: false, prompt: "Wrong image" },
          ],
          question: "Which image matches?",
        },
      ],
    });

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: context.id },
    });

    expect(steps.map((step) => [step.position, step.kind])).toStrictEqual([
      [0, "multipleChoice"],
      [1, "selectImage"],
    ]);
    expect(steps[0]?.content).toStrictEqual({
      context: "Look at the rule.",
      options: [
        { feedback: "Correct!", id: "option-1", isCorrect: true, text: "It transfers" },
        { feedback: "Not quite.", id: "option-2", isCorrect: false, text: "It only applies here" },
      ],
      question: "What is true?",
    });
    expect(steps[1]?.content).toStrictEqual({
      options: [
        {
          feedback: "Correct!",
          id: "option-1",
          isCorrect: true,
          prompt: "Correct image",
          url: "https://example.com/correct.webp",
        },
        { feedback: "No.", id: "option-2", isCorrect: false, prompt: "Wrong image" },
      ],
      question: "Which image matches?",
    });
  });
});
