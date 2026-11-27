import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { attemptFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
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

  it("includes a finished mock miss that reused an older notebook entry", async () => {
    const user = await userFixture();

    const [skill, mock] = await Promise.all([
      skillFixture(),
      prisma.mockExam.create({
        data: { conditions: {}, sectionStartedAt: new Date(), status: "finished", userId: user.id },
      }),
    ]);

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
    const later = await recordLearnerAnswer({ ...miss, mockExamId: mock.id });
    expect(later.mistake?.id).toBe(earlier.mistake?.id);

    mockSession(user.id);
    const scoped = await getMistakePractice({ mockId: mock.id });

    expect(
      scoped.status === "ready" && scoped.practice.map((entry) => entry.mistakeId),
    ).toStrictEqual([earlier.mistake?.id]);
  });

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
