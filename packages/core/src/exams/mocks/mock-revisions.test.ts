import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { RENTING_SCENARIO } from "@zoonk/testing/fixtures/language";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import {
  holdLearnerRevision,
  readLearnerRevision,
  waitForBlockedStatement,
} from "../../_test-utils/learner-revision";
import { mockSession } from "../../_test-utils/mock-session";
import { createConversation } from "../../language/conversations/_utils/create-conversation";
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
import { mockConditionsSchema } from "./mock-contract";
import { startMock } from "./start-mock";
import { submitMockSection } from "./submit-mock-section";

async function sittingFixture() {
  const user = await userFixture();

  const section = {
    breakAfterMinutes: 10,
    itemIds: [],
    minutes: 20,
    name: null,
    questions: 0,
    routing: null,
  };

  const conditions = mockConditionsSchema.parse({
    day: null,
    fullLength: true,
    purpose: "practice",
    scoring: "raw",
    sections: [section, section],
    startTime: null,
    timeZone: null,
  });

  const mock = await prisma.mockExam.create({
    data: { conditions, sectionStartedAt: new Date(), startedAt: new Date(), userId: user.id },
  });

  mockSession(user.id);
  return { mock, user };
}

async function ownedSitting(id: string) {
  const found = await findOwnedMock(id);

  if (found.status !== "ready" || !found.owned.mock) {
    throw new Error("Expected a sitting");
  }

  return { mock: found.owned.mock, owned: found.owned };
}

describe("mock learner revisions", () => {
  it.each(["speakingMock", "examSpeaking"] as const)(
    "marks a new %s conversation through the shared insert",
    async (kind) => {
      const user = await userFixture();
      const before = await readLearnerRevision(user.id);

      await createConversation({
        chapterId: null,
        goal: null,
        kind,
        language: "pt",
        level: "A2",
        markChanged: true,
        minutes: 2,
        scenario: RENTING_SCENARIO,
        targetLanguage: "en",
        userId: user.id,
      });

      await expect(readLearnerRevision(user.id)).resolves.toBe(before + 1n);
    },
  );

  it("marks scheduled creation and expired unlink, while an existing sitting is unchanged", async () => {
    const { blockId, user } = await scheduledMockSetup();
    const block = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });
    await startStudyBlock({ blockId, input: {}, sessionId: block.sessionId });
    const before = await readLearnerRevision(user.id);
    const held = holdLearnerRevision({ userId: user.id });
    const pid = await held.pid;

    const starts = Promise.all([
      startMock({ blockId, input: {} }),
      startMock({ blockId, input: {} }),
    ]);

    try {
      await waitForBlockedStatement(pid, /UPDATE users SET learner_revision/u, 2);
    } finally {
      held.release();
      await held.done;
    }

    await starts;
    // The lock holder contributes one revision, and only one contender creates the sitting.
    await expect(readLearnerRevision(user.id)).resolves.toBe(before + 2n);
    await startMock({ blockId, input: {} });
    await expect(readLearnerRevision(user.id)).resolves.toBe(before + 2n);
    const sitting = await prisma.mockExam.findUniqueOrThrow({ where: { blockId } });

    await prisma.mockExam.update({
      data: { sectionStartedAt: new Date(Date.now() - 86_400_000) },
      where: { id: sitting.id },
    });

    await startMock({ blockId, input: {} });
    await expect(readLearnerRevision(user.id)).resolves.toBe(before + 4n);

    await expect(
      prisma.mockExam.findUniqueOrThrow({ where: { id: sitting.id } }),
    ).resolves.toMatchObject({ blockId: null });
  });

  it("serializes anytime starts at the learner row, with running retries unchanged", async () => {
    const { goal, user } = await scheduledMockSetup();
    const setup = await loadAnytimeMockSetup(goal);

    const pick = resolveAnytimeOption({
      choice: { shape: { area: null, day: null, kind: "full" } },
      setup,
    });

    if (!pick) {
      throw new Error("Expected a full mock option");
    }

    const input = { acceptFewer: true, goal, pick, setup, userId: user.id, writesCap: null };
    const before = await readLearnerRevision(user.id);

    const held = holdLearnerRevision({ userId: user.id });

    const pid = await held.pid;
    const requests = Promise.all([createAnytimeMock(input), createAnytimeMock(input)]);

    try {
      await waitForBlockedStatement(pid, /UPDATE users SET learner_revision/u, 2);
    } finally {
      held.release();
      await held.done;
    }

    const outcomes = await requests;

    expect(outcomes.map(({ status }) => status).toSorted()).toStrictEqual(["running", "started"]);
    await expect(readLearnerRevision(user.id)).resolves.toBe(before + 2n);
    await expect(createAnytimeMock(input)).resolves.toMatchObject({ status: "running" });
    await expect(readLearnerRevision(user.id)).resolves.toBe(before + 2n);
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

      const before = await readLearnerRevision(user.id);

      await expect(
        createAnytimeMock({
          acceptFewer,
          goal,
          pick: { option, purpose: "practice" },
          setup,
          userId: user.id,
          writesCap: null,
        }),
      ).resolves.toStrictEqual({ status });

      await expect(readLearnerRevision(user.id)).resolves.toBe(before);
      await expect(prisma.mockExam.count({ where: { goalId: goal.id } })).resolves.toBe(0);
      expect(mock.goalId).toBeNull();
    },
  );

  it("rolls back the anytime creation marker when a short mock needs acceptance", async () => {
    const { goal, user } = await scheduledMockSetup();
    const setup = await loadAnytimeMockSetup(goal);

    const pick = resolveAnytimeOption({
      choice: { shape: { area: null, day: null, kind: "full" } },
      setup,
    });

    if (!pick) {
      throw new Error("Expected a full mock option");
    }

    const before = await readLearnerRevision(user.id);

    await expect(
      createAnytimeMock({
        acceptFewer: false,
        goal,
        pick,
        setup,
        userId: user.id,
        writesCap: "day",
      }),
    ).resolves.toMatchObject({ limit: "day", status: "short" });

    await expect(readLearnerRevision(user.id)).resolves.toBe(before);
    await expect(prisma.mockExam.count({ where: { goalId: goal.id } })).resolves.toBe(0);
  });

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
    const revision = await readLearnerRevision(user.id);
    const held = holdLearnerRevision({ userId: user.id });
    const pid = await held.pid;
    const request = completeMock({ mock: sitting.mock, owned, timeZone: "UTC" });

    try {
      await waitForBlockedStatement(pid, /UPDATE users SET learner_revision/u);
      const stored = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } });
      expect(stored.payload).toStrictEqual(block.payload);
    } finally {
      held.release();
      await held.done;
    }

    const result = await request;

    // The lock holder, the changed payload, and the finished result each commit one mark.
    await expect(readLearnerRevision(user.id)).resolves.toBe(revision + 3n);

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toMatchObject({ payload: { itemIds: [] } });

    const finished = await prisma.mockExam.findUniqueOrThrow({ where: { id: mock.id } });

    expect(finished).toMatchObject({ finishedAt: expect.any(Date), result, status: "finished" });

    const before = await readLearnerRevision(user.id);
    await completeMock({ mock: sitting.mock, owned, timeZone: "UTC" });
    await expect(readLearnerRevision(user.id)).resolves.toBe(before);

    await expect(
      prisma.mockExam.findUniqueOrThrow({ where: { id: mock.id } }),
    ).resolves.toStrictEqual(finished);
  });

  it("marks one section advance, then leaves duplicate submissions unchanged", async () => {
    const { mock, user } = await sittingFixture();
    const before = await readLearnerRevision(user.id);
    const held = holdLearnerRevision({ userId: user.id });
    const pid = await held.pid;

    const requests = Promise.all([
      submitMockSection({ blockId: mock.id, input: {}, section: 0 }),
      submitMockSection({ blockId: mock.id, input: {}, section: 0 }),
    ]);

    try {
      await waitForBlockedStatement(pid, /UPDATE users SET learner_revision/u, 2);
    } finally {
      held.release();
      await held.done;
    }

    const outcomes = await requests;

    expect(outcomes.map(({ status }) => status).toSorted()).toStrictEqual(["next", "notRunning"]);
    await expect(readLearnerRevision(user.id)).resolves.toBe(before + 2n);

    await expect(
      submitMockSection({ blockId: mock.id, input: {}, section: 0 }),
    ).resolves.toStrictEqual({ status: "notRunning" });

    await expect(readLearnerRevision(user.id)).resolves.toBe(before + 2n);
  });

  it("serializes competing break ends at the learner marker and commits only one", async () => {
    const { mock, user } = await sittingFixture();

    await prisma.mockExam.update({
      data: { sectionStartedAt: new Date(Date.now() + 600_000) },
      where: { id: mock.id },
    });

    const before = await readLearnerRevision(user.id);
    const held = holdLearnerRevision({ userId: user.id });
    const pid = await held.pid;

    const requests = Promise.all([
      endMockBreak({ blockId: mock.id }),
      endMockBreak({ blockId: mock.id }),
    ]);

    try {
      await waitForBlockedStatement(pid, /UPDATE users SET learner_revision/u, 2);
    } finally {
      held.release();
      await held.done;
    }

    const outcomes = await requests;

    expect(outcomes.map(({ status }) => status).toSorted()).toStrictEqual([
      "notOnBreak",
      "started",
    ]);

    await expect(readLearnerRevision(user.id)).resolves.toBe(before + 2n);
  });

  it("marks anytime progress before its progress locks and rolls back a retried settlement", async () => {
    const { mock, user } = await sittingFixture();
    const sitting = await ownedSitting(mock.id);
    const before = await readLearnerRevision(user.id);
    const held = holdLearnerRevision({ userId: user.id });
    const pid = await held.pid;

    const requests = Promise.all([
      settleAnytimeMock({ graded: [], mock: sitting.mock, timeZone: "UTC" }),
      settleAnytimeMock({ graded: [], mock: sitting.mock, timeZone: "UTC" }),
    ]);

    try {
      await waitForBlockedStatement(pid, /UPDATE users SET learner_revision/u, 2);
    } finally {
      held.release();
      await held.done;
    }

    await requests;
    await expect(readLearnerRevision(user.id)).resolves.toBe(before + 2n);
    await settleAnytimeMock({ graded: [], mock: sitting.mock, timeZone: "UTC" });
    await expect(readLearnerRevision(user.id)).resolves.toBe(before + 2n);

    await expect(
      prisma.learningEvent.findMany({ where: { kind: "mock", userId: user.id } }),
    ).resolves.toMatchObject([{ contentIds: { mockExamId: mock.id }, lessonKind: "anytimeMock" }]);
  });

  it("marks hand-in, progress and final result separately, then retries without a bump", async () => {
    const { mock, user } = await sittingFixture();
    const before = await readLearnerRevision(user.id);
    const held = holdLearnerRevision({ userId: user.id });
    const pid = await held.pid;

    const requests = Promise.all([
      finishMock({ blockId: mock.id, input: {} }),
      finishMock({ blockId: mock.id, input: {} }),
    ]);

    try {
      await waitForBlockedStatement(pid, /UPDATE users SET learner_revision/u);
    } finally {
      held.release();
      await held.done;
    }

    await expect(requests).resolves.toStrictEqual([{ status: "finished" }, { status: "finished" }]);
    await expect(readLearnerRevision(user.id)).resolves.toBe(before + 4n);

    await expect(finishMock({ blockId: mock.id, input: {} })).resolves.toStrictEqual({
      status: "finished",
    });

    await expect(readLearnerRevision(user.id)).resolves.toBe(before + 4n);
  });
});
