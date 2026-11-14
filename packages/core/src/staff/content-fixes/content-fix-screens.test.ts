import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  answerExplanationFixture,
  libraryStepFixture,
  stepVariantFixture,
} from "@zoonk/testing/fixtures/library-steps";
import { languageLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { describe, expect, it } from "vitest";
import { toStoredItem } from "../../library/items/item-content";
import { toScreenQuestion } from "../../library/lessons/_utils/screen-question-item";
import { writtenTemperatureLesson } from "../../library/quality/_test-utils/written-lessons";
import { toStepContent } from "../../library/steps/written-screens";
import {
  approve,
  proposeFix,
  publishedLesson,
  question,
  signInApprover,
  signInProposer,
} from "./_test-utils/content-fix-steps";
import { proposeContentFix } from "./propose-content-fix";

const fillBlank = playableStepContent.fillBlank;

function sharedTutorAnswer(stepId: string) {
  return prisma.tutorSharedAnswer.create({
    data: {
      answer: "A cloud maps where the electron is likely to be.",
      model: "test",
      promptVersion: "test",
      question: "Why a cloud?",
      runId: "test",
      stepId,
      suggestion: "simpler",
    },
  });
}

function setContent(model: "Step" | "StepVariant", id: string, content: object) {
  return { id, model, set: { content } };
}

describe("language exercise screens", () => {
  it("fixes a blank's sentence and answer together, deleting what was written from the old screen", async () => {
    const lesson = await libraryLessonFixture({ contentStatus: "completed" });

    const step = await libraryStepFixture({
      content: fillBlank,
      kind: "fillBlank",
      lessonId: lesson.id,
      position: 0,
    });

    await Promise.all([answerExplanationFixture({ stepId: step.id }), sharedTutorAnswer(step.id)]);
    await signInProposer();

    const fixed = {
      ...fillBlank,
      answers: ["cloud of chances"],
      template: "The electron is drawn as a [BLANK] around the nucleus.",
    };

    const fix = await proposeFix({
      changes: [setContent("Step", step.id, fixed)],
      reason: "The blank's sentence was cut short.",
    });

    expect(fix.effects).toStrictEqual(
      expect.arrayContaining([
        { id: step.id, kind: "answerKeyChanged", model: "Step" },
        { id: step.id, kind: "questionChanged", model: "Step" },
        { count: 1, kind: "answerExplanationsDeleted", stepId: step.id },
        { count: 1, kind: "tutorAnswersDeleted", stepId: step.id },
      ]),
    );

    const { key } = await signInApprover();
    await approve({ fixId: fix.id, key });

    await expect(prisma.step.findUniqueOrThrow({ where: { id: step.id } })).resolves.toMatchObject({
      content: fixed,
    });

    await expect(prisma.answerExplanation.count({ where: { stepId: step.id } })).resolves.toBe(0);
    await expect(prisma.tutorSharedAnswer.count({ where: { stepId: step.id } })).resolves.toBe(0);
  });

  it("sends a spoken screen's sentence and a word screen to their rows, and fixes the screen's own prompt", async () => {
    const { sentence, steps, word } = await languageLessonFixture();
    const vocabulary = steps.find((step) => step.kind === "vocabulary");
    const spoken = steps.find((step) => step.kind === "spokenAnswer");

    if (!vocabulary || !spoken) {
      throw new Error("Expected the language lesson's screens");
    }

    await signInProposer();

    const propose = (id: string, content: object) =>
      proposeContentFix({ changes: [setContent("Step", id, content)], reason: "Typo." });

    await expect(
      propose(spoken.id, { ...(spoken.content as object), targetText: "How much is the rent" }),
    ).resolves.toMatchObject({ message: expect.stringContaining(sentence.id), status: "invalid" });

    await expect(propose(vocabulary.id, {})).resolves.toMatchObject({
      message: expect.stringContaining(word.id),
      status: "invalid",
    });

    const fix = await proposeFix({
      changes: [
        setContent("Step", spoken.id, {
          ...(spoken.content as object),
          prompt: "Pergunte quanto custa o aluguel.",
        }),
      ],
      reason: "Clearer prompt.",
    });

    expect(fix.effects).toContainEqual({ id: spoken.id, kind: "questionChanged", model: "Step" });
  });
});

describe("screen versions", () => {
  it("keeps the versions a fix leaves out and sets the ones it names", async () => {
    const { check, lesson } = await publishedLesson();

    const [nursing, coding] = await Promise.all([
      stepVariantFixture({ content: question, key: "nursing", stepId: check.id }),
      stepVariantFixture({ content: question, key: "coding", stepId: check.id }),
    ]);

    await signInProposer();

    const reworded = { ...question, question: "What is 2 plus 2?" };

    const alone = await proposeFix({
      changes: [setContent("Step", check.id, reworded)],
      reason: "Spell out the operation.",
    });

    expect(alone.effects).toContainEqual({ count: 2, kind: "variantsKept", stepId: check.id });

    const together = await proposeFix({
      changes: [
        setContent("Step", check.id, reworded),
        setContent("StepVariant", nursing.id, { ...question, question: "What is 2 plus 2 doses?" }),
      ],
      reason: "Spell out the operation.",
    });

    expect(together.effects).toContainEqual({ count: 1, kind: "variantsKept", stepId: check.id });
    expect(together.unitId).toBe(lesson.id);

    const { key } = await signInApprover();
    await approve({ fixId: together.id, key });

    const variants = await prisma.stepVariant.findMany({
      select: { content: true, id: true },
      where: { stepId: check.id },
    });

    expect(variants).toStrictEqual(
      expect.arrayContaining([
        { content: { ...question, question: "What is 2 plus 2 doses?" }, id: nursing.id },
        { content: question, id: coding.id },
      ]),
    );
  });
});

function mathScreen() {
  const screen = writtenTemperatureLesson().screens.find((entry) => entry.kind === "mathCheck");

  if (screen?.kind !== "mathCheck") {
    throw new Error("The temperature lesson has a calculation");
  }

  return screen;
}

function drawScreen(screen: ReturnType<typeof mathScreen>) {
  const converted = toStepContent(screen, { allowImage: false, language: "en" });

  if (!converted.ok || !converted.mathItem) {
    throw new Error("The calculation draws a screen");
  }

  // oxlint-disable-next-line unicorn/prefer-structured-clone -- Stored as the column stores it: JSON drops undefined fields.
  const content: object = JSON.parse(JSON.stringify(converted.content));
  const asked = toScreenQuestion(converted.mathItem);

  if (!asked) {
    throw new Error("The calculation has a question");
  }

  // oxlint-disable-next-line unicorn/prefer-structured-clone -- Stored as the column stores it.
  const item: object = JSON.parse(JSON.stringify(toStoredItem(asked).content));

  return { content, item };
}

async function numericScreen() {
  const [lesson, skill] = await Promise.all([
    libraryLessonFixture({ contentStatus: "completed", language: "en" }),
    skillFixture(),
  ]);

  const drawn = drawScreen(mathScreen());
  const item = await itemFixture({ content: drawn.item, format: "numeric", skillId: skill.id });

  const step = await libraryStepFixture({
    content: drawn.content,
    itemId: item.id,
    kind: "check",
    lessonId: lesson.id,
    position: 0,
    skillId: skill.id,
  });

  return { drawn, item, lesson, step };
}

describe("numeric screens", () => {
  it("fixes a screen's numbers with its practice question in one fix", async () => {
    const { item, lesson, step } = await numericScreen();
    await answerExplanationFixture({ itemId: item.id });
    await signInProposer();

    const original = mathScreen();

    const corrected = {
      ...original,
      math: {
        ...original.math,
        answer: 2,
        variables: original.math.variables.map((variable) =>
          variable.name === "rise" ? { ...variable, value: 6 } : variable,
        ),
      },
    };

    const fixed = drawScreen(corrected);

    const fix = await proposeFix({
      changes: [
        setContent("Step", step.id, fixed.content),
        { id: item.id, model: "Item", set: { content: fixed.item } },
      ],
      reason: "The rise in the question doesn't match the worked steps.",
    });

    expect(fix).toMatchObject({ unit: "lesson", unitId: lesson.id });

    expect(fix.effects).toStrictEqual(
      expect.arrayContaining([
        { id: step.id, kind: "answerKeyChanged", model: "Step" },
        { count: 1, itemId: item.id, kind: "itemExplanationsDeleted" },
      ]),
    );

    expect(fix.effects).not.toContainEqual(
      expect.objectContaining({ id: step.id, kind: "questionChanged" }),
    );

    const { key } = await signInApprover();
    await approve({ fixId: fix.id, key });

    await expect(prisma.step.findUniqueOrThrow({ where: { id: step.id } })).resolves.toMatchObject({
      content: fixed.content,
    });

    await expect(prisma.item.findUniqueOrThrow({ where: { id: item.id } })).resolves.toMatchObject({
      content: fixed.item,
      retiredAt: null,
    });
  });

  it("refuses the screen or its question changed alone, showing the screen the question draws", async () => {
    const { drawn, item, step } = await numericScreen();
    await signInProposer();

    const screenAlone = await proposeContentFix({
      changes: [setContent("Step", step.id, { ...drawn.content, question: "How warm is it?" })],
      reason: "Shorter question.",
    });

    expect(screenAlone).toMatchObject({
      message: expect.stringContaining(`Item ${item.id}'s numeric question`),
      status: "invalid",
    });

    const original = mathScreen();
    const reworded = drawScreen({ ...original, question: `${original.question} Round it.` });

    const questionAlone = await proposeContentFix({
      changes: [{ id: item.id, model: "Item", set: { content: reworded.item } }],
      reason: "Ask for rounding.",
    });

    expect(questionAlone).toMatchObject({
      message: expect.stringContaining("Round it."),
      status: "invalid",
    });
  });

  it("refuses a question whose words and numbers change together", async () => {
    const { item, step } = await numericScreen();
    await signInProposer();

    const original = mathScreen();

    const both = drawScreen({
      ...original,
      math: { ...original.math, answer: 2, solution: "start + rise - 1" },
      question: `${original.question} Then it cooled a degree.`,
    });

    await expect(
      proposeContentFix({
        changes: [
          setContent("Step", step.id, both.content),
          { id: item.id, model: "Item", set: { content: both.item } },
        ],
        reason: "A new question.",
      }),
    ).resolves.toMatchObject({
      message: expect.stringContaining("both what learners read"),
      status: "invalid",
    });
  });
});
