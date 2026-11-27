import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getMock } from "../exams/mocks/get-mock";
import { mockConditionsSchema } from "../exams/mocks/mock-contract";
import { gradeChoiceAnswer, parseChoiceItem } from "../learner/_utils/choice-items";
import { recordLearnerAnswer } from "../learner/record-learner-answer";
import { finishStudyBlock } from "../sessions/finish-study-block";
import { answerMistakePractice } from "./answer-mistake-practice";
import { finishMistakePractice } from "./finish-mistake-practice";
import { getMistakePractice } from "./get-mistake-practice";

async function questions(userId: string) {
  const skill = await skillFixture();

  return Promise.all(
    [0, 1, 2, 3].map(async () => {
      const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });
      const mistake = await mistakeFixture({ itemId: item.id, skillId: skill.id, userId });
      return { item, mistake };
    }),
  );
}

describe("Scoped mistake practice", () => {
  it("keeps the block's frozen order and completes once after the last playable question", async () => {
    const [user, other] = await Promise.all([userFixture(), userFixture()]);

    const [assigned, session] = await Promise.all([
      questions(user.id),
      studySessionFixture({ startedAt: new Date(), status: "active", userId: user.id }),
    ]);

    const [first, last, retired, outside] = assigned;

    const block = await studySessionBlockFixture({
      kind: "review",
      payload: { mistakeIds: [last!.mistake.id, retired!.mistake.id, first!.mistake.id] },
      sessionId: session.id,
      status: "pending",
    });

    await prisma.item.update({ data: { retiredAt: new Date() }, where: { id: retired!.item.id } });

    const input = { blockId: block.id, timeZone: "UTC" };
    const finish = { ...input, answerIds: [] };

    mockSession(other.id);
    await expect(getMistakePractice(input)).resolves.toStrictEqual({ status: "notFound" });
    await expect(finishMistakePractice(finish)).resolves.toStrictEqual({ status: "notFound" });

    mockSession(user.id);
    const result = await getMistakePractice(input);

    expect(
      result.status === "ready" && result.practice.map((entry) => entry.mistakeId),
    ).toStrictEqual([last!.mistake.id, first!.mistake.id]);

    const answer = ({ item, mistake }: (typeof assigned)[number]) =>
      answerMistakePractice({
        input: {
          answer: { selectedIndex: 0 },
          attemptId: randomUUID(),
          durationMs: 4000,
          itemId: item.id,
          run: { answerIds: [], blockId: block.id },
          timeZone: "UTC",
        },
        mistakeId: mistake.id,
      });

    const blockRow = () => prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } });

    await expect(answer(outside!)).resolves.toStrictEqual({ status: "notFound" });
    await expect(answer(last!)).resolves.toMatchObject({ status: "ready" });
    await expect(blockRow()).resolves.toMatchObject({ completedAt: null, status: "pending" });

    await expect(
      finishStudyBlock({ blockId: block.id, input, sessionId: session.id }),
    ).resolves.toStrictEqual({ status: "unanswered" });

    await expect(getMistakePractice(input)).resolves.toMatchObject({
      practice: [{ mistakeId: first!.mistake.id }],
    });

    await expect(answer(first!)).resolves.toMatchObject({ status: "ready" });
    const finished = await blockRow();
    expect(finished).toMatchObject({ completedAt: expect.any(Date), status: "completed" });
    await expect(finishMistakePractice(finish)).resolves.toMatchObject({ status: "ready" });
    await expect(blockRow()).resolves.toStrictEqual(finished);

    await expect(
      prisma.attempt.count({ where: { studySessionId: null, userId: user.id } }),
    ).resolves.toBe(2);
  });

  it("keeps a block fixed from the notebook untouched until the empty completion POST", async () => {
    const user = await userFixture();
    const [assigned] = await questions(user.id);

    const session = await studySessionFixture({
      startedAt: new Date(),
      status: "active",
      userId: user.id,
    });

    const block = await studySessionBlockFixture({
      kind: "practice",
      payload: { mistakeIds: [assigned!.mistake.id] },
      sessionId: session.id,
      status: "pending",
    });

    await prisma.mistake.update({
      data: { missedAt: new Date(0) },
      where: { id: assigned!.mistake.id },
    });

    mockSession(user.id);

    await expect(
      answerMistakePractice({
        input: {
          answer: { selectedIndex: 0 },
          durationMs: 4000,
          itemId: assigned!.item.id,
          timeZone: "UTC",
        },
        mistakeId: assigned!.mistake.id,
      }),
    ).resolves.toMatchObject({ feedback: { fixed: true }, status: "ready" });

    const input = { blockId: block.id, timeZone: "UTC" };
    const read = () => prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } });

    await expect(getMistakePractice(input)).resolves.toMatchObject({
      practice: [],
      status: "ready",
    });

    await expect(read()).resolves.toStrictEqual(block);

    await expect(
      finishMistakePractice({ ...input, answerIds: [], ended: true }),
    ).resolves.toMatchObject({ result: { hasMorePractice: false, total: 0 }, status: "ready" });

    await expect(read()).resolves.toMatchObject({
      completedAt: expect.any(Date),
      status: "completed",
    });
  });

  it("includes a finished mock miss that reused an older notebook entry", async () => {
    const user = await userFixture();

    const [skill, goal, otherGoal] = await Promise.all([
      skillFixture(),
      goalFixture({ userId: user.id }),
      goalFixture({ userId: user.id }),
    ]);

    const mock = await prisma.mockExam.create({
      data: {
        conditions: mockConditionsSchema.parse({
          day: null,
          examQuestions: null,
          fullLength: true,
          partialCredit: "allOrNothing",
          purpose: "practice",
          reused: 0,
          scoring: "raw",
          sections: [],
          shape: null,
          startTime: null,
          timeZone: "UTC",
          timedOutSections: [],
          wrongPenalty: 0,
        }),
        finishedAt: new Date(),
        goalId: goal.id,
        sectionStartedAt: new Date(),
        status: "finished",
        userId: user.id,
      },
    });

    const row = await itemFixture({ content: choiceItemContent(), skillId: skill.id });
    const item = parseChoiceItem(row);

    if (!item) {
      throw new Error("The mock question must be playable");
    }

    const answer = { selectedIndex: 1 };
    const grade = gradeChoiceAnswer({ answer, item });

    const miss = {
      answer,
      graded: { durationMs: 4000, isCorrect: false },
      itemId: item.id,
      language: "en",
      mistake: { questionText: grade.snapshot.question, snapshot: grade.snapshot },
      purpose: "learning" as const,
      skillId: skill.id,
      timeZone: "UTC",
      userId: user.id,
    };

    const earlier = await recordLearnerAnswer(miss);

    await Promise.all([
      prisma.mistake.update({ data: { cause: "gap" }, where: { id: earlier.mistake!.id } }),
      attemptFixture({ isCorrect: true, itemId: item.id, skillId: skill.id, userId: user.id }),
      attemptFixture({ isCorrect: true, itemId: item.id, skillId: skill.id, userId: user.id }),
    ]);

    const later = await recordLearnerAnswer({ ...miss, mockExamId: mock.id });
    expect(later.attempt.cause).toBe("gap");
    expect(later.mistake?.id).toBe(earlier.mistake?.id);

    mockSession(user.id);
    const scoped = await getMistakePractice({ goalId: otherGoal.id, mockId: mock.id });

    expect(
      scoped.status === "ready" && scoped.practice.map((entry) => entry.mistakeId),
    ).toStrictEqual([earlier.mistake?.id]);

    await expect(getMock(mock.id)).resolves.toMatchObject({
      mock: { practiceAvailable: true },
      status: "ready",
    });

    await prisma.mistake.update({
      data: { missedAt: new Date(0) },
      where: { id: earlier.mistake!.id },
    });

    const answered = await answerMistakePractice({
      input: {
        answer: { selectedIndex: 0 },
        durationMs: 4000,
        itemId: item.id,
        run: { answerIds: [], mockId: mock.id },
        timeZone: "UTC",
      },
      mistakeId: earlier.mistake!.id,
    });

    if (answered.status !== "ready") {
      throw new Error(answered.status);
    }

    expect(answered.feedback.fixed).toBe(true);

    await expect(
      finishMistakePractice({
        answerIds: [answered.feedback.answerId],
        ended: true,
        mockId: mock.id,
        timeZone: "UTC",
      }),
    ).resolves.toMatchObject({ result: { hasMorePractice: false, total: 1 }, status: "ready" });

    await expect(
      prisma.learningEvent.findFirst({ where: { lessonKind: "mistakePractice", userId: user.id } }),
    ).resolves.toMatchObject({ goalId: goal.id });

    await expect(getMock(mock.id)).resolves.toMatchObject({
      mock: { practiceAvailable: false },
      status: "ready",
    });
  });

  it.each([false, true])(
    "offers another batch only for earlier misses (earlier: %s)",
    async (earlier) => {
      const user = await userFixture();
      const [first, next] = await questions(user.id);

      await prisma.mistake.update({
        data: { missedAt: new Date(0) },
        where: { id: first!.mistake.id },
      });

      if (earlier) {
        await prisma.mistake.update({
          data: { missedAt: new Date(0) },
          where: { id: next!.mistake.id },
        });
      }

      mockSession(user.id);

      const answered = await answerMistakePractice({
        input: {
          answer: { selectedIndex: 0 },
          durationMs: 4000,
          itemId: first!.item.id,
          timeZone: "UTC",
        },
        mistakeId: first!.mistake.id,
      });

      if (answered.status !== "ready") {
        throw new Error(answered.status);
      }

      await expect(
        finishMistakePractice({
          answerIds: [answered.feedback.answerId],
          ended: true,
          skillId: next!.mistake.skillId ?? undefined,
          timeZone: "UTC",
        }),
      ).resolves.toMatchObject({ result: { hasMorePractice: earlier }, status: "ready" });
    },
  );

  it("returns only an owned finished mock's mistakes, including today's", async () => {
    const [user, other] = await Promise.all([userFixture(), userFixture()]);

    const [assigned, mock] = await Promise.all([
      questions(user.id),
      prisma.mockExam.create({
        data: { conditions: {}, sectionStartedAt: new Date(), userId: user.id },
      }),
    ]);

    const [miss] = assigned;

    const attempt = await attemptFixture({
      answer: { selectedIndex: 1 },
      isCorrect: false,
      itemId: miss!.item.id,
      mockExamId: mock.id,
      userId: user.id,
    });

    await prisma.mistake.update({
      data: { attemptId: attempt.id },
      where: { id: miss!.mistake.id },
    });

    mockSession(user.id);

    await expect(getMistakePractice({ mockId: mock.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    const notebook = await getMistakePractice({});

    expect(
      notebook.status === "ready" && notebook.practice.map((entry) => entry.mistakeId),
    ).not.toContain(miss!.mistake.id);

    await prisma.mockExam.update({
      data: { finishedAt: new Date(), status: "finished" },
      where: { id: mock.id },
    });

    const scoped = await getMistakePractice({ mockId: mock.id });

    expect(
      scoped.status === "ready" && scoped.practice.map((entry) => entry.mistakeId),
    ).toStrictEqual([miss!.mistake.id]);

    mockSession(other.id);

    await expect(getMistakePractice({ mockId: mock.id })).resolves.toStrictEqual({
      status: "notFound",
    });
  });
});
