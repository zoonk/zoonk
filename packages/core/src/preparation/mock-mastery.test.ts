import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  answerRight,
  runningMock,
  scheduledMockSetup,
} from "../exams/mocks/_test-utils/scheduled-mock";
import { finishMock } from "../exams/mocks/finish-mock";
import { getMock } from "../exams/mocks/get-mock";
import { saveMockAnswer } from "../exams/mocks/save-mock-answer";
import { startMock } from "../exams/mocks/start-mock";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { DAY_MS, SESSION_NOW, SESSION_TODAY } from "../sessions/_test-utils/session-goal";
import { getGoalPreparation } from "./get-goal-preparation";

describe("mock answers in preparation's mastery evidence", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: SESSION_TODAY,
      currentInstant: SESSION_NOW,
      timeZone: "UTC",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts actual answers from a handed-in mock, while its blanks still count against the exam score", async () => {
    const { blockId, goal, skills, user } = await scheduledMockSetup();
    await startMock({ blockId, input: {} });
    const running = await runningMock(blockId);
    const questions = running.current?.questions ?? [];

    await Promise.all(
      questions
        .slice(0, 5)
        .map((question) =>
          attemptFixture({
            answer: { dontKnow: true },
            answeredAt: new Date(SESSION_NOW.getTime() - DAY_MS),
            isCorrect: false,
            isPlacement: true,
            itemId: question.itemId,
            skillId: question.skillId,
            userId: user.id,
          }),
        ),
    );

    await answerRight({ blockId, count: 5 });

    await saveMockAnswer({
      blockId,
      input: {
        answer: { selectedIndex: 1 },
        durationMs: 30_000,
        flagged: false,
        itemId: questions[5]?.itemId ?? "",
      },
    });

    await expect(finishMock({ blockId, input: {} })).resolves.toStrictEqual({ status: "finished" });

    await expect(getMock(blockId)).resolves.toMatchObject({
      mock: { result: { blank: 3, correct: 5, total: 9 }, status: "finished" },
      status: "ready",
    });

    const tested = await itemFixture({ skillId: skills[0]?.id ?? "" });
    await attemptFixture({ itemId: tested.id, skillId: tested.skillId, userId: user.id });

    const result = await getGoalPreparation(goal.id);

    expect(result.status === "ready" && result.preparation.components.mastery).toMatchObject({
      answered: 7,
      correct: 6,
      evidence: 7,
      value: 6 / 7,
    });

    expect(result.status === "ready" && result.preparation.components.mocks).toMatchObject({
      taken: 1,
      value: 5 / 9,
    });
  });

  it("keeps the first actual answer when a mock's blank question is answered later", async () => {
    const { blockId, goal, user } = await scheduledMockSetup();
    await startMock({ blockId, input: {} });
    const running = await runningMock(blockId);
    const question = running.current?.questions[0];

    await expect(finishMock({ blockId, input: {} })).resolves.toStrictEqual({ status: "finished" });

    const blank = await getGoalPreparation(goal.id);

    expect(blank.status === "ready" && blank.preparation.components.mastery).toMatchObject({
      answered: 0,
      correct: 0,
      value: null,
    });

    await Promise.all(
      (running.current?.questions ?? [])
        .slice(0, 5)
        .map((entry) =>
          attemptFixture({
            answeredAt: new Date(SESSION_NOW.getTime() + 1000),
            itemId: entry.itemId,
            skillId: entry.skillId,
            userId: user.id,
          }),
        ),
    );

    await attemptFixture({
      answeredAt: new Date(SESSION_NOW.getTime() + 2000),
      isCorrect: false,
      itemId: question?.itemId ?? "",
      skillId: question?.skillId ?? "",
      userId: user.id,
    });

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: SESSION_TODAY,
      currentInstant: new Date(SESSION_NOW.getTime() + 3000),
      timeZone: "UTC",
    });

    const answered = await getGoalPreparation(goal.id);

    expect(answered.status === "ready" && answered.preparation.components.mastery).toMatchObject({
      answered: 5,
      correct: 5,
      value: 1,
    });

    await expect(
      prisma.attempt.count({ where: { mockExamId: { not: null }, userId: user.id } }),
    ).resolves.toBe(9);
  });
});
