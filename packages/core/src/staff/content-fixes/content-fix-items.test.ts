import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  answerExplanationFixture,
  libraryStepFixture,
} from "@zoonk/testing/fixtures/library-steps";
import {
  choiceItemContent,
  itemFixture,
  itemSetFixture,
  skillFixture,
} from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { answerStudyQuestion } from "../../sessions/answer-study-question";
import { toBlockPayload } from "../../sessions/block-payload";
import {
  approve,
  proposeFix,
  revertFix,
  signInApprover,
  signInProposer,
} from "./_test-utils/content-fix-steps";
import { proposeContentFix } from "./propose-content-fix";

const choice = choiceItemContent("Which rule applies here?");
const [right, wrong] = choice.options;

if (!right || !wrong) {
  throw new Error("Expected two options");
}

const reworded = {
  ...choice,
  options: [
    { ...right, text: "The rule as stated" },
    { ...wrong, reason: "That reverses the rule." },
  ],
  question: "Which rule applies in this case?",
};

const trueFalse = {
  context: null,
  image: null,
  isTrue: true,
  misconception: null,
  reason: "Water boils at 100 °C at sea level.",
  statement: "Water boils at 100 °C at sea level.",
  visual: null,
};

const typed = {
  acceptedAnswers: ["Paris"],
  context: null,
  image: null,
  keyPoints: ["Names the capital of France"],
  question: "What is the capital of France?",
  sampleAnswer: "Paris",
  visual: null,
};

function setContent(id: string, content: unknown) {
  return { changes: [{ id, model: "Item", set: { content } }], reason: "Clearer wording." };
}

function replaceContent(id: string, content: unknown) {
  return { changes: [{ id, model: "Item", replace: { content } }], reason: "The key was wrong." };
}

async function bankItem(attrs: Partial<Parameters<typeof itemFixture>[0]> = {}) {
  const skill = await skillFixture();
  return itemFixture({ content: choice, skillId: skill.id, ...attrs });
}

async function proposeAndApprove(input: unknown) {
  await signInProposer();
  const fix = await proposeFix(input);
  const approver = await signInApprover();
  const decision = await approve({ fixId: fix.id, key: approver.key });

  return { approver, decision, fix };
}

describe("fixing a practice question's words in place", () => {
  it("rewrites a choice question and deletes the explanations written from its old words", async () => {
    const item = await bankItem();
    await answerExplanationFixture({ itemId: item.id });

    const { decision, fix } = await proposeAndApprove(setContent(item.id, reworded));

    expect(fix).toMatchObject({
      changes: [{ fields: [{ after: reworded, before: choice, field: "content" }], op: "set" }],
      effects: [{ count: 1, itemId: item.id, kind: "itemExplanationsDeleted" }],
      unit: "item",
    });

    expect(decision).toMatchObject({ fix: { status: "applied" } });

    await expect(prisma.item.findUniqueOrThrow({ where: { id: item.id } })).resolves.toMatchObject({
      content: reworded,
      retiredAt: null,
    });

    await expect(prisma.answerExplanation.count({ where: { itemId: item.id } })).resolves.toBe(0);

    await signInProposer();
    const revert = await revertFix({ fixId: fix.id, reason: "The old words were clearer." });
    const approver = await signInApprover();

    await expect(
      approve({ fixId: revert.status === "proposed" ? revert.fix.id : "", key: approver.key }),
    ).resolves.toMatchObject({ fix: { status: "applied" } });

    await expect(prisma.item.findUniqueOrThrow({ where: { id: item.id } })).resolves.toMatchObject({
      content: choice,
    });
  });

  it("rewords a true-or-false statement while it stays true", async () => {
    const item = await bankItem({ content: trueFalse, format: "trueFalse" });
    const statement = "At sea level, water boils at 100 °C.";

    await expect(
      proposeAndApprove(setContent(item.id, { ...trueFalse, statement })),
    ).resolves.toMatchObject({ decision: { fix: { status: "applied" } } });
  });

  it.each([
    [
      "which option is right",
      {
        ...choice,
        options: [
          { ...right, isCorrect: false },
          { ...wrong, isCorrect: true },
        ],
      },
    ],
    ["the options' order", { ...choice, options: [wrong, right] }],
    [
      "how many options there are",
      { ...choice, options: [right, wrong, { ...wrong, text: "Another wrong answer" }] },
    ],
    ["how many to pick", { ...choice, select: 2 }],
    ["whether the order is fixed", { ...choice, fixedOrder: true }],
    ["its picture", { ...choice, image: { alt: "A sign", prompt: "A road sign" } }],
  ])("refuses changing %s in place and names replace", async (_, content) => {
    const item = await bankItem();
    await signInProposer();

    await expect(proposeContentFix(setContent(item.id, content))).resolves.toMatchObject({
      message: expect.stringContaining("replace: { content }"),
      status: "invalid",
    });
  });

  it("refuses flipping a true-or-false key in place", async () => {
    const item = await bankItem({ content: trueFalse, format: "trueFalse" });
    await signInProposer();

    await expect(
      proposeContentFix(setContent(item.id, { ...trueFalse, isTrue: false })),
    ).resolves.toMatchObject({
      message: expect.stringContaining("replace: { content }"),
      status: "invalid",
    });
  });

  it("refuses a question graded by its words and points to replace", async () => {
    const item = await bankItem({ content: typed, format: "typed" });
    await signInProposer();

    await expect(
      proposeContentFix(
        setContent(item.id, { ...typed, question: "Which city is France's capital?" }),
      ),
    ).resolves.toMatchObject({
      message: expect.stringContaining("graded by its words"),
      status: "invalid",
    });
  });
});

describe("questions a fix can't change on their own", () => {
  it.each(["set", "replace"] as const)(
    "refuses %s on private, retired, set and screen questions",
    async (operation) => {
      const [privateSkill, set, lesson] = await Promise.all([
        skillFixture({ visibility: "private" }),
        itemSetFixture(),
        libraryLessonFixture({ contentStatus: "completed" }),
      ]);

      const [privateItem, retired, inSet, onScreen] = await Promise.all([
        itemFixture({ content: choice, skillId: privateSkill.id }),
        bankItem({ retiredAt: new Date() }),
        bankItem({ setId: set.id }),
        bankItem(),
      ]);

      await libraryStepFixture({ itemId: onScreen.id, lessonId: lesson.id });
      await signInProposer();

      const change = operation === "set" ? setContent : replaceContent;

      const results = await Promise.all(
        [privateItem, retired, inSet, onScreen].map((item) =>
          proposeContentFix(change(item.id, reworded)),
        ),
      );

      expect(results.map((result) => result.status === "invalid" && result.message)).toStrictEqual([
        expect.stringContaining("Private content"),
        expect.stringContaining("is retired"),
        expect.stringContaining("changes with its set"),
        expect.stringContaining("fix that screen instead"),
      ]);
    },
  );
});

describe("replacing a practice question", () => {
  it("retires the question and asks a copy whose id was chosen at proposal", async () => {
    const blueprint = await examBlueprintFixture();

    const item = await bankItem({
      content: typed,
      difficulty: 0.4,
      examBlueprintId: blueprint.id,
      field: "medicine",
      format: "typed",
    });

    const corrected = { ...typed, acceptedAnswers: ["Paris", "Paris, France"] };

    await signInProposer();
    const fix = await proposeFix(replaceContent(item.id, corrected));
    const [change] = fix.changes;
    const replacementId = change?.op === "replace" ? change.replacementId : "";

    expect(fix.effects).toStrictEqual([{ itemId: item.id, kind: "itemReplaced", replacementId }]);
    await expect(prisma.item.count({ where: { id: replacementId } })).resolves.toBe(0);

    const approver = await signInApprover();

    await expect(approve({ fixId: fix.id, key: approver.key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    const [original, replacement] = await Promise.all([
      prisma.item.findUniqueOrThrow({ where: { id: item.id } }),
      prisma.item.findUniqueOrThrow({ where: { id: replacementId } }),
    ]);

    expect(original).toMatchObject({ content: typed, retiredAt: expect.any(Date) });

    expect(replacement).toMatchObject({
      content: corrected,
      difficulty: 0.4,
      examBlueprintId: blueprint.id,
      field: "medicine",
      format: "typed",
      language: item.language,
      retiredAt: null,
      runId: fix.id,
      skillId: item.skillId,
    });
  });

  it("keeps grading a learner's open session by the question it already holds", async () => {
    const item = await bankItem();
    const learner = await userFixture();

    const session = await studySessionFixture({
      startedAt: new Date(),
      status: "active",
      userId: learner.id,
    });

    const block = await studySessionBlockFixture({
      kind: "practice",
      payload: toBlockPayload({ itemIds: [item.id] }),
      sessionId: session.id,
      startedAt: new Date(),
      status: "active",
    });

    const movedKey = {
      ...choice,
      options: [
        { ...right, isCorrect: false, misconception: "Reads the rule too broadly" },
        { ...wrong, isCorrect: true, misconception: null },
      ],
    };

    await proposeAndApprove(replaceContent(item.id, movedKey));
    mockSession(learner.id);

    await expect(
      answerStudyQuestion({
        blockId: block.id,
        input: { answer: { selectedIndex: 0 }, durationMs: 4000, itemId: item.id },
        sessionId: session.id,
      }),
    ).resolves.toMatchObject({ status: "ready" });

    await expect(
      prisma.attempt.findFirstOrThrow({ where: { itemId: item.id, userId: learner.id } }),
    ).resolves.toMatchObject({ isCorrect: true });
  });

  it("reverts by asking the original again, and refuses once another fix replaced the copy", async () => {
    const item = await bankItem({ content: typed, format: "typed" });
    const corrected = { ...typed, sampleAnswer: "Paris is the capital." };
    const { fix } = await proposeAndApprove(replaceContent(item.id, corrected));
    const [change] = fix.changes;
    const replacementId = change?.op === "replace" ? change.replacementId : "";

    await signInProposer();
    const revert = await revertFix({ fixId: fix.id, reason: "The old question was fine." });

    expect(revert).toMatchObject({
      fix: {
        changes: [{ id: item.id, model: "Item", op: "restore", retires: replacementId }],
        effects: [
          { itemId: item.id, kind: "itemRestored" },
          { itemId: replacementId, kind: "itemRetired" },
        ],
      },
      status: "proposed",
    });

    await proposeAndApprove(
      replaceContent(replacementId, { ...corrected, sampleAnswer: "It's Paris." }),
    );

    const approver = await signInApprover();

    await expect(
      approve({ fixId: revert.status === "proposed" ? revert.fix.id : "", key: approver.key }),
    ).resolves.toMatchObject({ fix: { status: "stale" } });

    await expect(
      prisma.item.findUniqueOrThrow({ select: { retiredAt: true }, where: { id: item.id } }),
    ).resolves.toStrictEqual({ retiredAt: expect.any(Date) });

    await signInProposer();

    await expect(revertFix({ fixId: fix.id, reason: "Undo again." })).resolves.toMatchObject({
      message: expect.stringContaining("left practice"),
      status: "invalid",
    });
  });
});
