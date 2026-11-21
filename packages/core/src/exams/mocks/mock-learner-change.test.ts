import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LEARNER_LOCK,
  holdLearnerLock,
  waitForBlockedStatement,
} from "../../_test-utils/learner-lock";
import { mockSession } from "../../_test-utils/mock-session";
import { toBlockPayload } from "../../sessions/block-payload";
import { startStudyBlock } from "../../sessions/start-study-block";
import { scheduledMockSetup } from "./_test-utils/scheduled-mock";
import { loadAnytimeMockSetup, resolveAnytimeOption } from "./_utils/anytime-mock-setup";
import { completeMock } from "./_utils/complete-mock";
import { createAnytimeMock } from "./_utils/create-anytime-mock";
import { findOwnedMock } from "./_utils/owned-mock";
import { settleAnytimeMock } from "./_utils/settle-anytime-mock";
import { endMockBreak } from "./end-mock-break";
import { finishMock } from "./finish-mock";
import { type MockConditions, mockConditionsSchema } from "./mock-contract";
import { saveMockAnswer } from "./save-mock-answer";
import { startMock } from "./start-mock";
import { submitMockSection } from "./submit-mock-section";

const EMPTY_SECTION = {
  breakAfterMinutes: 10,
  essays: [],
  itemIds: [],
  minutes: 20,
  name: null,
  questions: 0,
  routing: null,
};

type SittingSection = Partial<MockConditions["sections"][number]>;

async function sittingFixture(sections: SittingSection[] = [{}, {}]) {
  const user = await userFixture();

  const conditions = mockConditionsSchema.parse({
    day: null,
    examQuestions: null,
    fullLength: true,
    partialCredit: "allOrNothing",
    purpose: "practice",
    reused: 0,
    scoring: "raw",
    sections: sections.map((section) => ({ ...EMPTY_SECTION, ...section })),
    shape: null,
    startTime: null,
    timeZone: null,
    timedOutSections: [],
    wrongPenalty: 1,
  });

  const mock = await prisma.mockExam.create({
    data: { conditions, sectionStartedAt: new Date(), startedAt: new Date(), userId: user.id },
  });

  mockSession(user.id);
  return { mock, user };
}

async function choiceItems(count: number): Promise<string[]> {
  const skill = await skillFixture();
  const content = choiceItemContent();

  const items = await Promise.all(
    Array.from({ length: count }, () =>
      itemFixture({
        content: {
          ...content,
          options: [...content.options, { ...content.options[1], text: "Another wrong answer" }],
        },
        skillId: skill.id,
      }),
    ),
  );

  return items.map((item) => item.id);
}

function pick({ itemId, mockId, index }: { index: number; itemId: string; mockId: string }) {
  return saveMockAnswer({
    blockId: mockId,
    input: { answer: { selectedIndex: index }, durationMs: 5000, flagged: false, itemId },
  });
}

async function inLockOrder<T>(userId: string, requests: (() => Promise<T>)[]): Promise<T[]> {
  const held = holdLearnerLock({ userId });
  const pid = await held.pid;
  const started: Promise<T>[] = [];

  try {
    for (const request of requests) {
      started.push(request());
      // oxlint-disable-next-line no-await-in-loop -- Each request queues for the lock after the one before it.
      await waitForBlockedStatement(pid, LEARNER_LOCK, started.length);
    }
  } finally {
    held.release();
    await held.done;
  }

  return Promise.all(started);
}

async function ownedSitting(id: string) {
  const found = await findOwnedMock(id);

  if (found.status !== "ready" || !found.owned.mock) {
    throw new Error("Expected a sitting");
  }

  return { mock: found.owned.mock, owned: found.owned };
}

describe("mock writes under the learner's lock", () => {
  it("marks scheduled creation and expired unlink, while an existing sitting is unchanged", async () => {
    const { blockId, user } = await scheduledMockSetup();
    const block = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });
    await startStudyBlock({ blockId, input: {}, sessionId: block.sessionId });
    const held = holdLearnerLock({ userId: user.id });
    const pid = await held.pid;

    const starts = Promise.all([
      startMock({ blockId, input: {} }),
      startMock({ blockId, input: {} }),
    ]);

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK, 2);
    } finally {
      held.release();
      await held.done;
    }

    await starts;
    await startMock({ blockId, input: {} });
    const sitting = await prisma.mockExam.findUniqueOrThrow({ where: { blockId } });

    await prisma.mockExam.update({
      data: { sectionStartedAt: new Date(Date.now() - 86_400_000) },
      where: { id: sitting.id },
    });

    await startMock({ blockId, input: {} });

    await expect(
      prisma.mockExam.findUniqueOrThrow({ where: { id: sitting.id } }),
    ).resolves.toMatchObject({ blockId: null });
  });

  it("serializes anytime starts at the learner row, with running retries unchanged", async () => {
    const { goal, user } = await scheduledMockSetup();
    const setup = await loadAnytimeMockSetup(goal);

    const option = resolveAnytimeOption({
      choice: { shape: { area: null, day: null, kind: "full" } },
      setup,
    });

    if (!option) {
      throw new Error("Expected a full mock option");
    }

    const input = { acceptFewer: true, goal, option, setup, userId: user.id, writesCap: null };

    const held = holdLearnerLock({ userId: user.id });

    const pid = await held.pid;
    const requests = Promise.all([createAnytimeMock(input), createAnytimeMock(input)]);

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK, 2);
    } finally {
      held.release();
      await held.done;
    }

    const outcomes = await requests;

    expect(outcomes.map(({ status }) => status).toSorted()).toStrictEqual(["running", "started"]);
    await expect(createAnytimeMock(input)).resolves.toMatchObject({ status: "running" });
  });

  it.each([
    { acceptFewer: true, status: "notEnoughQuestions" },
    { acceptFewer: false, status: "needsQuestions" },
  ] as const)(
    "rolls back the anytime creation marker for $status",
    async ({ acceptFewer, status }) => {
      const { user, mock } = await sittingFixture();
      const goal = await goalFixture({ kind: "exam", userId: user.id });
      const setup = await loadAnytimeMockSetup(goal);

      const option = {
        area: null,
        areas: [],
        covers: null,
        day: null,
        estimatedMinutes: 20,
        kind: "full" as const,
        leftOut: [],
        minutes: 20,
        objectiveOnly: true,
        questions: 20,
        written: [],
      };

      await expect(
        createAnytimeMock({ acceptFewer, goal, option, setup, userId: user.id, writesCap: null }),
      ).resolves.toStrictEqual({ status });

      await expect(prisma.mockExam.count({ where: { goalId: goal.id } })).resolves.toBe(0);
      expect(mock.goalId).toBeNull();
    },
  );

  it.each(["day", "rolling30Days"] as const)(
    "rolls back the anytime creation marker when a short mock needs acceptance at %s",
    async (period) => {
      const { goal, user } = await scheduledMockSetup();
      const setup = await loadAnytimeMockSetup(goal);

      const option = resolveAnytimeOption({
        choice: { shape: { area: null, day: null, kind: "full" } },
        setup,
      });

      if (!option) {
        throw new Error("Expected a full mock option");
      }

      await expect(
        createAnytimeMock({
          acceptFewer: false,
          goal,
          option,
          setup,
          userId: user.id,
          writesCap: {
            period,
            ...(period === "rolling30Days" && { availableAt: new Date("2031-02-01T12:00:00Z") }),
          },
        }),
      ).resolves.toMatchObject({
        limit: period,
        ...(period === "rolling30Days" && { availableAt: new Date("2031-02-01T12:00:00Z") }),
        status: "short",
      });

      await expect(prisma.mockExam.count({ where: { goalId: goal.id } })).resolves.toBe(0);
    },
  );

  it("marks a block payload before locking it and leaves a repeated completion unchanged", async () => {
    const { mock, user } = await sittingFixture();
    const session = await studySessionFixture({ userId: user.id });

    const block = await studySessionBlockFixture({
      kind: "checkpoint",
      payload: toBlockPayload({ itemIds: [crypto.randomUUID()] }),
      sessionId: session.id,
      status: "skipped",
    });

    const sitting = await ownedSitting(mock.id);
    const owned = { ...sitting.owned, block };
    const held = holdLearnerLock({ userId: user.id });
    const pid = await held.pid;
    const request = completeMock({ mock: sitting.mock, owned, timeZone: "UTC" });

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK);
      const stored = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } });
      expect(stored.payload).toStrictEqual(block.payload);
    } finally {
      held.release();
      await held.done;
    }

    const result = await request;

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toMatchObject({ payload: { itemIds: [] } });

    const finished = await prisma.mockExam.findUniqueOrThrow({ where: { id: mock.id } });

    expect(finished).toMatchObject({ finishedAt: expect.any(Date), result, status: "finished" });

    await completeMock({ mock: sitting.mock, owned, timeZone: "UTC" });

    await expect(
      prisma.mockExam.findUniqueOrThrow({ where: { id: mock.id } }),
    ).resolves.toStrictEqual(finished);
  });

  it("marks one section advance, then leaves duplicate submissions unchanged", async () => {
    const { mock, user } = await sittingFixture();
    const held = holdLearnerLock({ userId: user.id });
    const pid = await held.pid;

    const requests = Promise.all([
      submitMockSection({ blockId: mock.id, input: {}, section: 0 }),
      submitMockSection({ blockId: mock.id, input: {}, section: 0 }),
    ]);

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK, 2);
    } finally {
      held.release();
      await held.done;
    }

    const outcomes = await requests;

    expect(outcomes.map(({ status }) => status).toSorted()).toStrictEqual(["next", "notRunning"]);

    await expect(
      submitMockSection({ blockId: mock.id, input: {}, section: 0 }),
    ).resolves.toStrictEqual({ status: "notRunning" });
  });

  it("serializes competing break ends at the learner marker and commits only one", async () => {
    const { mock, user } = await sittingFixture();

    await prisma.mockExam.update({
      data: { sectionStartedAt: new Date(Date.now() + 600_000) },
      where: { id: mock.id },
    });

    const held = holdLearnerLock({ userId: user.id });
    const pid = await held.pid;

    const requests = Promise.all([
      endMockBreak({ blockId: mock.id }),
      endMockBreak({ blockId: mock.id }),
    ]);

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK, 2);
    } finally {
      held.release();
      await held.done;
    }

    const outcomes = await requests;

    expect(outcomes.map(({ status }) => status).toSorted()).toStrictEqual([
      "notOnBreak",
      "started",
    ]);
  });

  it("marks anytime progress before its progress locks and rolls back a retried settlement", async () => {
    const { mock, user } = await sittingFixture();
    const sitting = await ownedSitting(mock.id);
    const held = holdLearnerLock({ userId: user.id });
    const pid = await held.pid;

    const requests = Promise.all([
      settleAnytimeMock({ graded: [], mock: sitting.mock, timeZone: "UTC" }),
      settleAnytimeMock({ graded: [], mock: sitting.mock, timeZone: "UTC" }),
    ]);

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK, 2);
    } finally {
      held.release();
      await held.done;
    }

    await requests;
    await settleAnytimeMock({ graded: [], mock: sitting.mock, timeZone: "UTC" });

    await expect(
      prisma.learningEvent.findMany({ where: { kind: "mock", userId: user.id } }),
    ).resolves.toMatchObject([{ contentIds: { mockExamId: mock.id }, lessonKind: "anytimeMock" }]);
  });

  it("marks hand-in, progress and final result separately, then retries unchanged", async () => {
    const { mock, user } = await sittingFixture();
    const held = holdLearnerLock({ userId: user.id });
    const pid = await held.pid;

    const requests = Promise.all([
      finishMock({ blockId: mock.id, input: {} }),
      finishMock({ blockId: mock.id, input: {} }),
    ]);

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK);
    } finally {
      held.release();
      await held.done;
    }

    await expect(requests).resolves.toStrictEqual([{ status: "finished" }, { status: "finished" }]);

    await expect(finishMock({ blockId: mock.id, input: {} })).resolves.toStrictEqual({
      status: "finished",
    });
  });

  it("refuses a save that reaches the lock after its section was handed in", async () => {
    const [first = "", second = ""] = await choiceItems(2);

    const { mock, user } = await sittingFixture([
      { itemIds: [first], questions: 1 },
      { itemIds: [second], questions: 1 },
    ]);

    const [handIn, save] = await inLockOrder<{ status: string }>(user.id, [
      () => submitMockSection({ blockId: mock.id, input: {}, section: 0 }),
      () => pick({ index: 0, itemId: first, mockId: mock.id }),
    ]);

    expect(handIn).toStrictEqual({ status: "next" });
    expect(save).toStrictEqual({ status: "notRunning" });
    await expect(prisma.mockExamAnswer.count({ where: { mockExamId: mock.id } })).resolves.toBe(0);
  });

  it("charges one answer change when two saves change the same review question at once", async () => {
    const itemIds = await choiceItems(2);
    const [first = ""] = itemIds;

    const { mock, user } = await sittingFixture([
      {
        itemIds,
        navigation: { answerChanges: 2, forwardOnly: true, itemSeconds: null, mustAnswer: true },
        questions: itemIds.length,
      },
    ]);

    for (const itemId of itemIds) {
      // oxlint-disable-next-line no-await-in-loop -- A forward-only section is answered in order.
      await pick({ index: 0, itemId, mockId: mock.id });
    }

    const saves = await inLockOrder(user.id, [
      () => pick({ index: 1, itemId: first, mockId: mock.id }),
      () => pick({ index: 2, itemId: first, mockId: mock.id }),
    ]);

    expect(saves).toStrictEqual([{ status: "saved" }, { status: "saved" }]);

    await expect(
      prisma.mockExamAnswer.findUniqueOrThrow({
        where: { mockItem: { itemId: first, mockExamId: mock.id } },
      }),
    ).resolves.toMatchObject({ answer: { selectedIndex: 2 }, changes: 1 });
  });

  it("routes the next module from an answer saved just before the hand-in", async () => {
    const [first = "", easier = "", harder = ""] = await choiceItems(3);

    const { mock, user } = await sittingFixture([
      { itemIds: [first], questions: 1 },
      { questions: 1, routing: { easier: [easier], harder: [harder] } },
    ]);

    await inLockOrder<{ status: string }>(user.id, [
      () => pick({ index: 0, itemId: first, mockId: mock.id }),
      () => submitMockSection({ blockId: mock.id, input: {}, section: 0 }),
    ]);

    const stored = await prisma.mockExam.findUniqueOrThrow({ where: { id: mock.id } });

    expect(mockConditionsSchema.parse(stored.conditions).sections[1]?.itemIds).toStrictEqual([
      harder,
    ]);
  });

  it("grades an answer saved just before the final hand-in", async () => {
    const [first = ""] = await choiceItems(1);
    const { mock, user } = await sittingFixture([{ itemIds: [first], questions: 1 }]);

    await inLockOrder<{ status: string }>(user.id, [
      () => pick({ index: 0, itemId: first, mockId: mock.id }),
      () => finishMock({ blockId: mock.id, input: {} }),
    ]);

    await expect(
      prisma.mockExam.findUniqueOrThrow({ where: { id: mock.id } }),
    ).resolves.toMatchObject({ result: { correct: 1 }, status: "finished" });
  });

  it("uses an answer change to fill a skipped question in the review", async () => {
    const itemIds = await choiceItems(3);
    const [first = "", second = "", last = ""] = itemIds;

    const { mock } = await sittingFixture([
      {
        itemIds,
        navigation: { answerChanges: 1, forwardOnly: true, itemSeconds: null, mustAnswer: false },
        questions: itemIds.length,
      },
    ]);

    await pick({ index: 0, itemId: last, mockId: mock.id });

    await expect(pick({ index: 0, itemId: first, mockId: mock.id })).resolves.toStrictEqual({
      status: "saved",
    });

    await expect(pick({ index: 0, itemId: second, mockId: mock.id })).resolves.toStrictEqual({
      status: "locked",
    });
  });

  describe("with the clock moving while a hand-in waits for the lock", () => {
    const MINUTE_MS = 60_000;
    const START = new Date("2031-03-04T12:00:00Z");

    afterEach(() => {
      vi.useRealTimers();
    });

    async function handInAcross<T>(
      userId: string,
      { after, before, request }: { after: number; before: number; request: () => Promise<T> },
    ): Promise<T> {
      vi.setSystemTime(START.getTime() + before);
      const held = holdLearnerLock({ userId });
      const pid = await held.pid;
      const result = request();

      try {
        await waitForBlockedStatement(pid, LEARNER_LOCK);
        vi.setSystemTime(START.getTime() + after);
      } finally {
        held.release();
        await held.done;
      }

      return result;
    }

    it("answers expired when the mock runs out of time while its section is handed in", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(START);
      const { mock, user } = await sittingFixture([{ questions: 1 }, { questions: 1 }]);
      const expiresAfter = 30 * MINUTE_MS;

      await expect(
        handInAcross(user.id, {
          after: expiresAfter + 1,
          before: expiresAfter - 1,
          request: () => submitMockSection({ blockId: mock.id, input: {}, section: 0 }),
        }),
      ).resolves.toStrictEqual({ status: "expired" });
    });

    it("counts the last section as timed out when its clock runs out while it's handed in", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(START);
      const { mock, user } = await sittingFixture([{}]);
      const deadline = 20 * MINUTE_MS;

      await handInAcross(user.id, {
        after: deadline + 1,
        before: deadline - 1,
        request: () => finishMock({ blockId: mock.id, input: {} }),
      });

      const stored = await prisma.mockExam.findUniqueOrThrow({ where: { id: mock.id } });

      expect(mockConditionsSchema.parse(stored.conditions).timedOutSections).toStrictEqual([0]);
    });
  });
});
