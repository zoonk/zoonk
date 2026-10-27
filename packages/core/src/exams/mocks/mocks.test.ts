import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { SESSION_NOW } from "../../sessions/_test-utils/session-goal";
import {
  MINUTE_MS,
  answerRight,
  runningMock,
  scheduledMockSetup,
} from "./_test-utils/scheduled-mock";
import { finishMock } from "./finish-mock";
import { getMock } from "./get-mock";
import { saveMockAnswer } from "./save-mock-answer";
import { startMock } from "./start-mock";
import { submitMockSection } from "./submit-mock-section";

describe("mock exams", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not offer a scheduled mock move onto a resting Monday", async () => {
    const { blockId, goal, plan, skills } = await scheduledMockSetup();
    const settings = parsePlanSettings(plan.settings);

    await prisma.plan.update({
      data: {
        graph: {
          phases: [{ milestone: null, name: "Basics" }],
          skills: skills.map((skill) => ({
            area: null,
            lessons: 1,
            name: skill.name,
            phase: 0,
            skillId: skill.id,
            weight: null,
          })),
        },
        settings: { ...settings, weekdayMinutes: null },
      },
      where: { id: plan.id },
    });

    await expect(getMock(blockId)).resolves.toMatchObject({
      mock: { canMove: true, status: "ready" },
      status: "ready",
    });

    const minutes = goal.dailyMinutes;

    await prisma.plan.update({
      data: {
        settings: {
          ...settings,
          weekdayMinutes: [minutes, 0, minutes, minutes, minutes, minutes, minutes],
        },
      },
      where: { id: plan.id },
    });

    const [beforePlan, beforeBlock] = await Promise.all([
      prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } }),
    ]);

    await expect(getMock(blockId)).resolves.toMatchObject({
      mock: { canMove: false, status: "ready" },
      status: "ready",
    });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toStrictEqual(
      beforePlan,
    );

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } }),
    ).resolves.toStrictEqual(beforeBlock);
  });

  it("shows the conditions, runs without feedback and grades once handed in", async () => {
    const { blockId, goal } = await scheduledMockSetup();
    const intro = await getMock(blockId);

    expect(intro).toMatchObject({
      mock: {
        current: null,
        minutes: 15,
        number: 1,
        questions: 9,
        scoring: "raw",
        sections: [{ name: "Math", questions: 9, status: "upcoming" }],
        status: "ready",
      },
      status: "ready",
    });

    await expect(startMock({ blockId, input: {} })).resolves.toStrictEqual({ status: "ready" });

    const running = await runningMock(blockId);
    const questions = running.current?.questions ?? [];

    expect(questions).toHaveLength(9);
    expect(JSON.stringify(questions)).not.toContain("isCorrect");

    const [first, second, third, ...rest] = questions;

    await saveMockAnswer({
      blockId,
      input: {
        answer: { selectedIndex: 1 },
        durationMs: 90_000,
        flagged: true,
        itemId: first?.itemId ?? "",
      },
    });

    await saveMockAnswer({
      blockId,
      input: {
        answer: { selectedIndex: 1 },
        durationMs: 60_000,
        flagged: false,
        itemId: second?.itemId ?? "",
      },
    });

    await saveMockAnswer({
      blockId,
      input: { answer: null, durationMs: 10_000, flagged: false, itemId: third?.itemId ?? "" },
    });

    // Each saved answer is on the sheet a reload or another device opens: one change each.

    await Promise.all(
      rest.map((question) =>
        saveMockAnswer({
          blockId,
          input: {
            answer: { selectedIndex: 0 },
            durationMs: 30_000,
            flagged: false,
            itemId: question.itemId,
          },
        }),
      ),
    );

    await expect(submitMockSection({ blockId, input: {}, section: 0 })).resolves.toStrictEqual({
      status: "finished",
    });

    const finished = await getMock(blockId);

    expect(finished).toMatchObject({
      mock: {
        result: { blank: 1, correct: 6, net: null, scoring: "raw", total: 9 },
        status: "finished",
      },
      status: "ready",
    });

    const review = finished.status === "ready" ? finished.mock.review : [];

    expect(review.map((entry) => entry.outcome).toSorted()).toStrictEqual([
      "blank",
      "wrong",
      "wrong",
    ]);

    const [event, planItem] = await Promise.all([
      prisma.learningEvent.findFirst({ where: { goalId: goal.id, kind: "mock" } }),
      prisma.planItem.findFirst({ where: { kind: "mock", plan: { goalId: goal.id } } }),
    ]);

    expect(event).toMatchObject({ correctAnswers: 6, incorrectAnswers: 3 });
    expect(planItem?.status).toBe("done");

    // Handing it in again changes nothing.
    await expect(submitMockSection({ blockId, input: {}, section: 0 })).resolves.toStrictEqual({
      status: "finished",
    });
  });

  it("numbers a mock after the goal's finished mocks, skipping one left unfinished", async () => {
    const { blockId, goal, user } = await scheduledMockSetup();
    const lastWeek = new Date(SESSION_NOW.getTime() - 7 * 24 * 60 * MINUTE_MS);
    const earlier = { conditions: {}, createdAt: lastWeek, goalId: goal.id, userId: user.id };

    await prisma.mockExam.createMany({
      data: [
        { ...earlier, finishedAt: lastWeek, sectionStartedAt: lastWeek, status: "finished" },
        { ...earlier, sectionStartedAt: lastWeek, status: "active" },
      ],
    });

    await expect(getMock(blockId)).resolves.toMatchObject({ mock: { number: 2 }, status: "ready" });
  });

  it("scores Cebraspe exams as a net score with calibration from flags", async () => {
    const { blockId } = await scheduledMockSetup("wrongCancelsRight");
    await startMock({ blockId, input: {} });

    const running = await runningMock(blockId);
    const [wrongUnsure, ...rest] = running.current?.questions ?? [];

    await saveMockAnswer({
      blockId,
      input: {
        answer: { selectedIndex: 1 },
        durationMs: 1000,
        flagged: true,
        itemId: wrongUnsure?.itemId ?? "",
      },
    });

    await Promise.all(
      rest.map((question) =>
        saveMockAnswer({
          blockId,
          input: {
            answer: { selectedIndex: 0 },
            durationMs: 1000,
            flagged: false,
            itemId: question.itemId,
          },
        }),
      ),
    );

    await finishMock({ blockId, input: {} });
    const finished = await getMock(blockId);

    expect(finished.status === "ready" && finished.mock.result).toMatchObject({
      calibration: { sure: { answered: 8, right: 8 }, unsure: { answered: 1, right: 0 } },
      net: { blank: 0, max: 9, net: 7, right: 8, wrong: 1 },
      scoring: "net",
    });
  });

  it("estimates an item response theory score as a range", async () => {
    const { blockId } = await scheduledMockSetup("itemResponseTheory");
    await startMock({ blockId, input: {} });

    const running = await runningMock(blockId);

    await Promise.all(
      (running.current?.questions ?? []).map((question) =>
        saveMockAnswer({
          blockId,
          input: {
            answer: { selectedIndex: 0 },
            durationMs: 1000,
            flagged: false,
            itemId: question.itemId,
          },
        }),
      ),
    );

    await finishMock({ blockId, input: {} });
    const finished = await getMock(blockId);
    const irt = finished.status === "ready" ? finished.mock.result?.irt : null;

    expect(irt?.low).toBeLessThan(irt?.high ?? 0);
    expect(irt?.score).toBeGreaterThan(500);
  });

  it("takes no answers once a section's time has run out", async () => {
    const { blockId } = await scheduledMockSetup();
    await startMock({ blockId, input: {} });

    const running = await runningMock(blockId);
    const itemId = running.current?.questions[0]?.itemId ?? "";

    vi.setSystemTime(new Date(SESSION_NOW.getTime() + running.minutes * MINUTE_MS + MINUTE_MS));

    await expect(
      saveMockAnswer({
        blockId,
        input: { answer: { selectedIndex: 0 }, durationMs: 1000, flagged: false, itemId },
      }),
    ).resolves.toStrictEqual({ status: "timeUp" });

    await submitMockSection({ blockId, input: {}, section: 0 });
    const finished = await getMock(blockId);

    expect(finished.status === "ready" && finished.mock.result).toMatchObject({
      blank: 9,
      unansweredAtTimeout: 9,
    });
  });

  it("changes nothing when the same draft is saved again", async () => {
    const { blockId } = await scheduledMockSetup();
    await startMock({ blockId, input: {} });

    const running = await runningMock(blockId);
    const itemId = running.current?.questions[0]?.itemId ?? "";
    const draft = { answer: { selectedIndex: 1 }, durationMs: 4000, flagged: false, itemId };

    await saveMockAnswer({ blockId, input: draft });

    // A retry whose first response was lost sends the same draft.
    await expect(saveMockAnswer({ blockId, input: draft })).resolves.toStrictEqual({
      status: "saved",
    });

    await saveMockAnswer({ blockId, input: { ...draft, flagged: true } });
  });

  it("is not found for another learner", async () => {
    const { blockId } = await scheduledMockSetup();
    const other = await userFixture();

    mockSession(other.id);

    await expect(getMock(blockId)).resolves.toStrictEqual({ status: "notFound" });
    await expect(startMock({ blockId, input: {} })).resolves.toStrictEqual({ status: "notFound" });
  });
});

describe(finishMock, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("leaves early: unanswered questions count as blank, not timed out, and stay out of the notebook", async () => {
    const { blockId, user } = await scheduledMockSetup();
    await startMock({ blockId, input: {} });
    await answerRight({ blockId, count: 3 });

    await expect(finishMock({ blockId, input: {} })).resolves.toStrictEqual({ status: "finished" });

    const finished = await getMock(blockId);

    expect(finished.status === "ready" && finished.mock.result).toMatchObject({
      blank: 6,
      correct: 3,
      total: 9,
      unansweredAtTimeout: 0,
    });

    const [attempts, mistakes] = await Promise.all([
      prisma.attempt.findMany({ where: { userId: user.id } }),
      prisma.mistake.count({ where: { userId: user.id } }),
    ]);

    expect(attempts).toHaveLength(9);
    expect(attempts.filter((attempt) => !attempt.isCorrect)).toHaveLength(6);
    expect(mistakes).toBe(0);
  });

  it("counts what's still unanswered once the section's clock ran out as timed out", async () => {
    const { blockId } = await scheduledMockSetup();
    await startMock({ blockId, input: {} });
    const running = await answerRight({ blockId, count: 2 });

    vi.setSystemTime(new Date(SESSION_NOW.getTime() + running.minutes * MINUTE_MS + MINUTE_MS));

    await expect(finishMock({ blockId, input: {} })).resolves.toStrictEqual({ status: "finished" });

    const finished = await getMock(blockId);

    expect(finished.status === "ready" && finished.mock.result).toMatchObject({
      blank: 7,
      correct: 2,
      unansweredAtTimeout: 7,
    });
  });

  it("ends only the learner's own running mock, and grades it once", async () => {
    const { blockId, user } = await scheduledMockSetup();

    await expect(finishMock({ blockId, input: {} })).resolves.toStrictEqual({
      status: "notRunning",
    });

    await startMock({ blockId, input: {} });
    await answerRight({ blockId, count: 9 });

    const other = await userFixture();
    mockSession(other.id);

    await expect(finishMock({ blockId, input: {} })).resolves.toStrictEqual({ status: "notFound" });

    mockSession(null);

    await expect(finishMock({ blockId, input: {} })).resolves.toStrictEqual({
      status: "unauthorized",
    });

    mockSession(user.id);
    await finishMock({ blockId, input: {} });
    const graded = await getMock(blockId);

    await expect(finishMock({ blockId, input: {} })).resolves.toStrictEqual({ status: "finished" });

    await expect(getMock(blockId)).resolves.toStrictEqual(graded);
    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(9);
  });

  // Together, the second finish races the hand-in; a moment later, it arrives while the first grades.
  it.each([0, 10])(
    "grades once when a second finish comes %i ms after the first",
    async (gapMs) => {
      const { blockId, goal, user } = await scheduledMockSetup();
      await startMock({ blockId, input: {} });
      await answerRight({ blockId, count: 9 });

      const first = finishMock({ blockId, input: {} });

      await new Promise((resolve) => {
        setTimeout(resolve, gapMs);
      });

      await expect(Promise.all([first, finishMock({ blockId, input: {} })])).resolves.toStrictEqual(
        [{ status: "finished" }, { status: "finished" }],
      );

      const [perItem, events, finished] = await Promise.all([
        prisma.attempt.groupBy({ _count: true, by: ["itemId"], where: { userId: user.id } }),
        prisma.learningEvent.count({ where: { goalId: goal.id, kind: "mock" } }),
        getMock(blockId),
      ]);

      expect(perItem).toHaveLength(9);
      expect(perItem.every((row) => row._count === 1)).toBe(true);
      expect(events).toBe(1);

      expect(finished.status === "ready" && finished.mock.result).toMatchObject({
        correct: 9,
        total: 9,
      });
    },
  );

  it("grades a finish that stopped halfway on the next try, recording each answer once", async () => {
    const { blockId, user } = await scheduledMockSetup();
    await startMock({ blockId, input: {} });
    const running = await answerRight({ blockId, count: 9 });
    const firstItemId = running.current?.questions[0]?.itemId ?? "";

    const [block, item, mock] = await Promise.all([
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } }),
      prisma.item.findUniqueOrThrow({ where: { id: firstItemId } }),
      prisma.mockExam.findUniqueOrThrow({ where: { blockId } }),
    ]);

    // Every section was handed in and the first answer recorded, then the finish failed.
    await Promise.all([
      prisma.mockExam.update({ data: { sectionIndex: 1 }, where: { id: mock.id } }),
      attemptFixture({
        itemId: item.id,
        mockExamId: mock.id,
        skillId: item.skillId,
        studySessionId: block.sessionId,
        userId: user.id,
      }),
    ]);

    await expect(finishMock({ blockId, input: {} })).resolves.toStrictEqual({ status: "finished" });

    const [finished, perItem] = await Promise.all([
      getMock(blockId),
      prisma.attempt.groupBy({ _count: true, by: ["itemId"], where: { userId: user.id } }),
    ]);

    expect(finished.status === "ready" && finished.mock.result).toMatchObject({
      correct: 9,
      total: 9,
    });

    expect(perItem).toHaveLength(9);
    expect(perItem.every((row) => row._count === 1)).toBe(true);
  });
});
