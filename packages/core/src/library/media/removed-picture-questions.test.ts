import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { pickItemInBlock, pickItemInMock } from "../../_test-utils/shown-choice";
import { finishMock } from "../../exams/mocks/finish-mock";
import { getMock } from "../../exams/mocks/get-mock";
import { saveMockAnswer } from "../../exams/mocks/save-mock-answer";
import { submitMockSection } from "../../exams/mocks/submit-mock-section";
import { learnerGoalFixture } from "../../learner/_test-utils/learner-goal";
import { placementItemBank } from "../../learner/_test-utils/placement-tap-items";
import { getChapterTestOut } from "../../learner/test-out/get-chapter-test-out";
import { submitChapterTestOut } from "../../learner/test-out/submit-chapter-test-out";
import { answerStudyQuestion } from "../../sessions/answer-study-question";
import { type BlockPayload, toBlockPayload } from "../../sessions/block-payload";
import { finishStudyBlock } from "../../sessions/finish-study-block";
import { getStudyBlock } from "../../sessions/get-study-block";
import { removeImageAsset } from "./check-image-asset";

function picturedContent() {
  return {
    ...choiceItemContent(`Where does the arrow in the picture point? ${randomUUID()}`),
    image: { alt: "A compass whose arrow points north.", prompt: "A compass." },
  };
}

async function heldQuestions({
  kind = "practice",
  payload = {},
  withPlain = true,
}: {
  kind?: "checkpoint" | "practice";
  payload?: Partial<BlockPayload>;
  withPlain?: boolean;
} = {}) {
  const [user, skill, asset] = await Promise.all([
    userFixture(),
    skillFixture(),
    mediaAssetFixture(),
  ]);

  const [pictured, plain] = await Promise.all([
    itemFixture({ content: picturedContent(), mediaAssetId: asset.id, skillId: skill.id }),
    itemFixture({ skillId: skill.id }),
  ]);

  mockSession(user.id);

  const session = await studySessionFixture({
    startedAt: new Date(),
    status: "active",
    userId: user.id,
  });

  const block = await studySessionBlockFixture({
    kind,
    payload: toBlockPayload({
      ...payload,
      itemIds: withPlain ? [pictured.id, plain.id] : [pictured.id],
    }),
    sessionId: session.id,
    startedAt: new Date(),
    status: "active",
  });

  const ids = { blockId: block.id, sessionId: session.id };

  const answer = async (itemId: string) =>
    answerStudyQuestion({
      ...ids,
      input: {
        answer: await pickItemInBlock({ blockId: block.id, itemId }),
        durationMs: 4000,
        itemId,
      },
    });

  return { answer, asset, ids, pictured, plain };
}

describe("a question whose picture is removed after a failed check", () => {
  it("keeps the learner's answer to it in their practice block", async () => {
    const { answer, asset, ids, pictured, plain } = await heldQuestions();

    await answer(pictured.id);
    await answer(plain.id);
    await removeImageAsset({ assetId: asset.id });

    await expect(finishStudyBlock({ ...ids, input: { timeZone: "UTC" } })).resolves.toMatchObject({
      completion: { correct: 2, total: 2 },
      status: "ready",
    });
  });

  it("records an answer the learner gives it after the picture is removed", async () => {
    const { answer, asset, ids, pictured } = await heldQuestions();

    await removeImageAsset({ assetId: asset.id });

    await expect(answer(pictured.id)).resolves.toMatchObject({ status: "ready" });

    await expect(finishStudyBlock({ ...ids, input: { timeZone: "UTC" } })).resolves.toMatchObject({
      completion: { correct: 1, total: 1 },
      status: "ready",
    });
  });

  it("ends a practice block it leaves without questions, so the learner can go on", async () => {
    const { asset, ids } = await heldQuestions({ withPlain: false });

    await removeImageAsset({ assetId: asset.id });

    const view = await getStudyBlock(ids);

    expect(view.status === "ready" && view.detail.questions).toStrictEqual([]);

    await expect(finishStudyBlock({ ...ids, input: { timeZone: "UTC" } })).resolves.toMatchObject({
      completion: { correct: 0, total: 0 },
      status: "ready",
    });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: ids.blockId } }),
    ).resolves.toMatchObject({ status: "skipped" });
  });

  it("drops out of a checkpoint that hasn't asked it yet, which then finishes without it", async () => {
    const { answer, asset, ids, plain } = await heldQuestions({
      kind: "checkpoint",
      payload: {
        checkpoint: {
          kind: "boss",
          mock: false,
          passMark: 1,
          phase: 0,
          rematch: false,
          timeLimitMinutes: null,
        },
      },
    });

    await answer(plain.id);
    await removeImageAsset({ assetId: asset.id });

    const view = await getStudyBlock(ids);

    expect(
      view.status === "ready" && view.detail.questions.map((question) => question.itemId),
    ).toStrictEqual([plain.id]);

    await expect(finishStudyBlock({ ...ids, input: { timeZone: "UTC" } })).resolves.toMatchObject({
      completion: { correct: 1, total: 1 },
      status: "ready",
    });
  });

  it("leaves a running mock's unanswered question ungraded, and grades an answered one", async () => {
    const [user, skill, asset] = await Promise.all([
      userFixture(),
      skillFixture(),
      mediaAssetFixture(),
    ]);

    const [earlier, answered, unasked, plain] = await Promise.all([
      itemFixture({ skillId: skill.id }),
      itemFixture({ content: picturedContent(), mediaAssetId: asset.id, skillId: skill.id }),
      itemFixture({ content: picturedContent(), mediaAssetId: asset.id, skillId: skill.id }),
      itemFixture({ skillId: skill.id }),
    ]);

    const mock = await prisma.mockExam.create({
      data: {
        conditions: {
          day: null,
          examQuestions: null,
          fullLength: true,
          partialCredit: "allOrNothing",
          purpose: "practice",
          reused: 0,
          scoring: "raw",
          sections: [
            {
              essays: [],
              itemIds: [earlier.id],
              minutes: 30,
              name: "First section",
              questions: 1,
              routing: null,
            },
            {
              essays: [],
              itemIds: [answered.id, unasked.id, plain.id],
              minutes: 30,
              name: "Questions",
              questions: 3,
              routing: null,
            },
          ],
          shape: null,
          startTime: null,
          timeZone: null,
          timedOutSections: [],
          wrongPenalty: 1,
        },
        sectionStartedAt: new Date(),
        startedAt: new Date(),
        userId: user.id,
      },
    });

    mockSession(user.id);

    const save = async (itemId: string) =>
      saveMockAnswer({
        blockId: mock.id,
        input: {
          answer: await pickItemInMock({ itemId, mockId: mock.id }),
          durationMs: 4000,
          flagged: false,
          itemId,
        },
      });

    await save(earlier.id);

    await expect(
      submitMockSection({ blockId: mock.id, input: {}, section: 0 }),
    ).resolves.toStrictEqual({ status: "next" });

    await save(answered.id);
    await removeImageAsset({ assetId: asset.id });

    const view = await getMock(mock.id);

    expect(view).toMatchObject({
      mock: {
        current: {
          questionTotal: 2,
          questions: [
            { itemId: answered.id, number: 1 },
            { itemId: plain.id, number: 2 },
          ],
          section: 1,
        },
      },
      status: "ready",
    });

    await expect(finishMock({ blockId: mock.id, input: {} })).resolves.toStrictEqual({
      status: "finished",
    });

    await expect(getMock(mock.id)).resolves.toMatchObject({
      mock: { review: [{ itemId: plain.id, number: 2, outcome: "blank", section: 1, total: 2 }] },
      status: "ready",
    });

    const attempts = await prisma.attempt.findMany({
      select: { isCorrect: true, itemId: true },
      where: { mockExamId: mock.id },
    });

    expect(
      attempts.toSorted((a, b) => (a.itemId ?? "").localeCompare(b.itemId ?? "")),
    ).toStrictEqual(
      [
        { isCorrect: true, itemId: earlier.id },
        { isCorrect: true, itemId: answered.id },
        { isCorrect: false, itemId: plain.id },
      ].toSorted((a, b) => a.itemId.localeCompare(b.itemId)),
    );
  });

  it("leaves a running mock's unanswered question out of the next module's routing", async () => {
    const [user, skill, asset] = await Promise.all([
      userFixture(),
      skillFixture(),
      mediaAssetFixture(),
    ]);

    const [unasked, plain, easier, harder] = await Promise.all([
      itemFixture({ content: picturedContent(), mediaAssetId: asset.id, skillId: skill.id }),
      itemFixture({ skillId: skill.id }),
      itemFixture({ skillId: skill.id }),
      itemFixture({ skillId: skill.id }),
    ]);

    const section = { essays: [], minutes: 30, name: "Module" };

    const mock = await prisma.mockExam.create({
      data: {
        conditions: {
          day: null,
          examQuestions: null,
          fullLength: true,
          partialCredit: "allOrNothing",
          purpose: "practice",
          reused: 0,
          scoring: "raw",
          sections: [
            { ...section, itemIds: [unasked.id, plain.id], questions: 2, routing: null },
            {
              ...section,
              itemIds: [],
              questions: 1,
              routing: { easier: [easier.id], harder: [harder.id] },
            },
          ],
          shape: null,
          startTime: null,
          timeZone: null,
          timedOutSections: [],
          wrongPenalty: 1,
        },
        sectionStartedAt: new Date(),
        startedAt: new Date(),
        userId: user.id,
      },
    });

    mockSession(user.id);
    await removeImageAsset({ assetId: asset.id });

    await saveMockAnswer({
      blockId: mock.id,
      input: {
        answer: await pickItemInMock({ itemId: plain.id, mockId: mock.id }),
        durationMs: 4000,
        flagged: false,
        itemId: plain.id,
      },
    });

    await expect(
      submitMockSection({ blockId: mock.id, input: {}, section: 0 }),
    ).resolves.toStrictEqual({ status: "next" });

    const view = await getMock(mock.id);

    expect(
      view.status === "ready" && view.mock.current?.questions.map((question) => question.itemId),
    ).toStrictEqual([harder.id]);
  });

  it("grades a test-out the learner answered while it had the picture", async () => {
    const user = await userFixture();

    const [{ chapters, goal, skills }, asset] = await Promise.all([
      learnerGoalFixture({ itemsPerSkill: 0, phases: [4, 2], userId: user.id }),
      mediaAssetFixture(),
    ]);

    const bank = await placementItemBank(skills.slice(0, 4).map((skill) => skill.id));
    const answers = new Map(bank.flat().map(({ answer, item }) => [item.id, answer]));

    await prisma.item.update({
      data: { content: picturedContent(), mediaAssetId: asset.id },
      where: { id: bank[0]![0]!.item.id },
    });

    mockSession(user.id);
    const chapterId = chapters[0]?.id ?? "";
    const testOut = await getChapterTestOut({ chapterId, goalId: goal.id });
    const asked = testOut.status === "ready" ? testOut.testOut.questions : [];

    expect(asked.find((question) => question.itemId === bank[0]![0]!.item.id)?.image?.url).toBe(
      asset.url,
    );

    await removeImageAsset({ assetId: asset.id });

    await expect(
      submitChapterTestOut({
        chapterId,
        goalId: goal.id,
        input: {
          answers: asked.map((question) => ({
            answer: answers.get(question.itemId)!,
            durationMs: 4000,
            itemId: question.itemId,
          })),
          requestId: randomUUID(),
        },
      }),
    ).resolves.toMatchObject({ outcome: { correct: 16, total: 16 }, status: "ready" });
  });
});

describe("a question block with nothing answered yet", () => {
  it("keeps an essay block open, since its essay isn't a question that can go missing", async () => {
    const [user, skill] = await Promise.all([userFixture(), skillFixture()]);

    const essay = await itemFixture({
      content: {
        question: "Describe what happened yesterday.",
        rubric: [{ criterion: "Clarity", description: "A clear account" }],
        sampleOutline: "Describe the events in order.",
      },
      format: "essay",
      skillId: skill.id,
    });

    mockSession(user.id);

    const session = await studySessionFixture({
      startedAt: new Date(),
      status: "active",
      userId: user.id,
    });

    const block = await studySessionBlockFixture({
      kind: "produce",
      payload: toBlockPayload({ itemIds: [essay.id] }),
      sessionId: session.id,
      startedAt: new Date(),
      status: "active",
    });

    await expect(
      finishStudyBlock({ blockId: block.id, input: { timeZone: "UTC" }, sessionId: session.id }),
    ).resolves.toStrictEqual({ status: "noAnswers" });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toMatchObject({ status: "active" });
  });
});
