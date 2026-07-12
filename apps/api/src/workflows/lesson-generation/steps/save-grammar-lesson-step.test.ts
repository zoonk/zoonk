import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { saveGrammarLessonStep } from "./save-grammar-lesson-step";

/**
 * Builds distinguishable grammar batches so the concurrency test can prove
 * that persistence kept one complete generation instead of mixing both saves.
 */
function createGrammarContent({
  includeSecondExample = false,
  marker,
}: {
  includeSecondExample?: boolean;
  marker: string;
}) {
  const examples = [
    { highlight: `ist-${marker}`, sentence: `Das ist ${marker}`, translation: `That is ${marker}` },
    includeSecondExample && {
      highlight: `war-${marker}`,
      sentence: `Das war ${marker}`,
      translation: `That was ${marker}`,
    },
  ].filter((example): example is Exclude<typeof example, false> => Boolean(example));

  return {
    examples,
    explanations: [{ text: `Explanation ${marker}`, title: `Rule ${marker}` }],
    questions: [
      {
        answer: `ist-${marker}`,
        distractors: [`war-${marker}`, `hat-${marker}`],
        feedback: `Feedback ${marker}`,
        question: `Question ${marker}`,
        template: "Das [BLANK] gut",
      },
    ],
  };
}

describe(saveGrammarLessonStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("saves grammar explanations, examples, and practice steps", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);

    const context = await createLessonContext({
      kind: "grammar",
      organizationId,
      targetLanguage: "de",
    });

    await saveGrammarLessonStep({
      context,
      grammarContent: {
        examples: [
          { highlight: `ist${id}`, sentence: `Das ist${id} gut`, translation: `That is${id} good` },
          {
            highlight: `war${id}`,
            sentence: `Das war${id} toll`,
            translation: `That was${id} great`,
          },
        ],
        explanations: [
          { text: `Use ist${id} when something is true now.`, title: `Present tense ${id}` },
        ],
        questions: [
          {
            answer: `ist${id}`,
            distractors: [`war${id}`, `hat${id}`],
            feedback: `Because ist${id} fits here`,
            question: `Fill in the blank ${id}`,
            template: "Das [BLANK] gut",
          },
        ],
      },
      romanizations: {
        [`Das ist${id} gut`]: `das ist${id} gut`,
        [`Das war${id} toll`]: `das war${id} toll`,
        [`ist${id}`]: `ist${id}`,
        [`war${id}`]: `war${id}`,
      },
    });

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: context.id },
    });

    expect(steps.map((step) => [step.position, step.kind])).toStrictEqual([
      [0, "static"],
      [1, "static"],
      [2, "static"],
      [3, "fillBlank"],
    ]);

    expect(steps[0]?.content).toStrictEqual({
      text: `Use ist${id} when something is true now.`,
      title: `Present tense ${id}`,
      variant: "text",
    });

    expect(steps[1]?.content).toMatchObject({
      romanization: `das ist${id} gut`,
      sentence: `Das ist${id} gut`,
      translation: `That is${id} good`,
      variant: "grammarExample",
    });

    expect(steps[3]?.content).toStrictEqual({
      answers: [`ist${id}`],
      distractors: [`war${id}`, `hat${id}`],
      feedback: `Because ist${id} fits here`,
      question: `Fill in the blank ${id}`,
      romanizations: {
        [`Das ist${id} gut`]: `das ist${id} gut`,
        [`ist${id}`]: `ist${id}`,
        [`war${id}`]: `war${id}`,
      },
      template: "Das [BLANK] gut",
    });
  });

  it("keeps one complete step batch when saves run concurrently", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);

    const context = await createLessonContext({
      kind: "grammar",
      organizationId,
      targetLanguage: "de",
    });

    const batches = [
      {
        content: createGrammarContent({ marker: `first-${id}` }),
        expectedStepCount: 3,
        marker: `first-${id}`,
      },
      {
        content: createGrammarContent({ includeSecondExample: true, marker: `second-${id}` }),
        expectedStepCount: 4,
        marker: `second-${id}`,
      },
    ];

    const firstDeleteCompleted = Promise.withResolvers<null>();
    const secondDeleteCompleted = Promise.withResolvers<null>();
    const deleteSteps = prisma.step.deleteMany.bind(prisma.step);
    const deleteSpy = vi.spyOn(prisma.step, "deleteMany");

    deleteSpy
      .mockImplementationOnce(
        (args) =>
          deleteSteps(args).then(async (result) => {
            firstDeleteCompleted.resolve(null);
            await secondDeleteCompleted.promise;
            return result;
          }) as ReturnType<typeof deleteSteps>,
      )
      .mockImplementationOnce(
        (args) =>
          deleteSteps(args).then(async (result) => {
            secondDeleteCompleted.resolve(null);
            await firstDeleteCompleted.promise;
            return result;
          }) as ReturnType<typeof deleteSteps>,
      );

    try {
      await Promise.all(
        batches.map((batch) =>
          saveGrammarLessonStep({ context, grammarContent: batch.content, romanizations: null }),
        ),
      );
    } finally {
      deleteSpy.mockRestore();
    }

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: context.id },
    });

    const completeBatchWasSaved = batches.some(
      (batch) =>
        steps.length === batch.expectedStepCount &&
        steps.every((step) => JSON.stringify(step.content).includes(batch.marker)),
    );

    expect(completeBatchWasSaved).toBe(true);
    expect(new Set(steps.map((step) => step.position)).size).toBe(steps.length);
  });
});
