import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, it } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { saveGrammarLessonStep } from "./save-grammar-lesson-step";

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
});
