import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { savePracticeLessonStep } from "./save-practice-lesson-step";

describe(savePracticeLessonStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  test("saves practice scenario and question steps with option ids", async () => {
    const context = await createLessonContext({ kind: "practice", organizationId });
    const images = [
      {
        prompt: "Support desk with refund dashboard.",
        url: "https://example.com/practice-scenario.webp",
      },
      {
        prompt: "Refund dashboard with a highlighted row.",
        url: "https://example.com/practice-question.webp",
      },
    ];

    await savePracticeLessonStep({
      content: {
        kind: "practice",
        scenario: {
          imagePrompt: images[0]!.prompt,
          text: "A support report does not line up with the refund totals.",
          title: "Night shift",
        },
        steps: [
          {
            context: "The discounted orders are the only ones acting weird.",
            imagePrompt: images[1]!.prompt,
            options: [
              { feedback: "Correct!", isCorrect: true, text: "Check discounts" },
              { feedback: "Not yet.", isCorrect: false, text: "Ignore it" },
            ],
            question: "Where do we start?",
          },
        ],
      },
      context,
      images,
    });

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: context.id },
    });

    expect(steps.map((step) => [step.position, step.kind])).toEqual([
      [0, "static"],
      [1, "multipleChoice"],
    ]);
    expect(steps[0]?.content).toEqual({
      image: images[0],
      text: "A support report does not line up with the refund totals.",
      title: "Night shift",
      variant: "intro",
    });
    expect(steps[1]?.content).toEqual({
      context: "The discounted orders are the only ones acting weird.",
      image: images[1],
      options: [
        { feedback: "Correct!", id: "option-1", isCorrect: true, text: "Check discounts" },
        { feedback: "Not yet.", id: "option-2", isCorrect: false, text: "Ignore it" },
      ],
      question: "Where do we start?",
    });
  });
});
