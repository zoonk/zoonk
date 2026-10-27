import { prisma } from "@zoonk/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getChallenge } from "../../checkpoints/get-challenge";
import { DAY_MS, SESSION_NOW } from "../../sessions/_test-utils/session-goal";
import {
  MINUTE_MS,
  answerRight,
  runningMock,
  scheduledMockSetup,
} from "./_test-utils/scheduled-mock";
import { finishMock } from "./finish-mock";
import { getMock } from "./get-mock";
import { getMockOptions } from "./get-mock-options";
import { mockConditionsSchema } from "./mock-contract";
import { startAnytimeMock } from "./start-anytime-mock";
import { startMock } from "./start-mock";
import { submitMockSection } from "./submit-mock-section";

const UTC = "UTC";

/** A moment `minutes` after the running section's clock ran out. */
function afterTheClock({ minutes, running }: { minutes: number; running: { minutes: number } }) {
  return new Date(SESSION_NOW.getTime() + (running.minutes + minutes) * MINUTE_MS);
}

async function startAnytime(goalId: string) {
  const options = await getMockOptions({ goalId });
  const option = options.status === "ready" ? options.view.options[0] : undefined;

  if (!option) {
    throw new Error("Expected a mock to take any time");
  }

  const shape = { area: option.area, day: option.day, kind: option.kind };
  // The bank holds fewer questions than the exam asks: the mock asks the ones there are.
  const started = await startAnytimeMock({ goalId, input: { acceptFewer: true, shape } });

  if (started.status !== "started") {
    throw new Error(`Expected a started mock, got ${started.status}`);
  }

  return { id: started.id, shape };
}

describe("a mock whose time ran out while the learner was away", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("isn't scored, recorded or counted toward preparation, however it's handed in", async () => {
    const { blockId, goal, user } = await scheduledMockSetup();
    await startMock({ blockId, input: {} });

    // One answer of the section's questions, then three days away.
    const running = await answerRight({ blockId, count: 1 });
    expect(running.current?.questions.length).toBeGreaterThan(1);

    vi.setSystemTime(new Date(SESSION_NOW.getTime() + 3 * DAY_MS));

    await expect(getMock(blockId)).resolves.toMatchObject({
      mock: { current: null, mistakes: [], result: null, review: [], status: "expired" },
      status: "ready",
    });

    // The screen's clock hands the section in as the learner comes back, or they finish it.
    await expect(submitMockSection({ blockId, input: {}, section: 0 })).resolves.toStrictEqual({
      status: "expired",
    });

    await expect(finishMock({ blockId, input: {} })).resolves.toStrictEqual({ status: "expired" });

    const [attempts, ledger, mistakes, block, sitting] = await Promise.all([
      prisma.attempt.count({ where: { userId: user.id } }),
      prisma.learningEvent.count({ where: { goalId: goal.id, kind: "mock", userId: user.id } }),
      prisma.mistake.count({ where: { userId: user.id } }),
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } }),
      prisma.mockExam.findFirstOrThrow({ where: { userId: user.id } }),
    ]);

    expect({ attempts, ledger, mistakes }).toStrictEqual({ attempts: 0, ledger: 0, mistakes: 0 });
    expect(block.status).not.toBe("completed");

    expect({ finishedAt: sitting.finishedAt, result: sitting.result }).toStrictEqual({
      finishedAt: null,
      result: null,
    });
  });

  it("is graded when it's handed in within ten minutes of the clock, as by a learner still there", async () => {
    const { blockId } = await scheduledMockSetup();
    await startMock({ blockId, input: {} });
    const running = await answerRight({ blockId, count: 2 });

    vi.setSystemTime(afterTheClock({ minutes: 9, running }));

    await expect(submitMockSection({ blockId, input: {}, section: 0 })).resolves.toStrictEqual({
      status: "finished",
    });

    await expect(getMock(blockId)).resolves.toMatchObject({
      mock: { result: { correct: 2, unansweredAtTimeout: 7 }, status: "finished" },
    });
  });

  it("is graded as it stands when most of it was answered, however late it's handed in", async () => {
    const { blockId } = await scheduledMockSetup();
    await startMock({ blockId, input: {} });
    const running = await answerRight({ blockId, count: 6 });

    vi.setSystemTime(new Date(SESSION_NOW.getTime() + 3 * DAY_MS));

    await expect(getMock(blockId)).resolves.toMatchObject({ mock: { status: "running" } });

    await expect(submitMockSection({ blockId, input: {}, section: 0 })).resolves.toStrictEqual({
      status: "finished",
    });

    await expect(getMock(blockId)).resolves.toMatchObject({
      mock: {
        result: { correct: 6, unansweredAtTimeout: (running.current?.questions.length ?? 0) - 6 },
        status: "finished",
      },
    });
  });

  it("lets the learner take the plan's mock again from its challenge, in a new sitting", async () => {
    const { blockId, mockItem } = await scheduledMockSetup();
    await startMock({ blockId, input: {} });
    const running = await answerRight({ blockId, count: 1 });

    vi.setSystemTime(afterTheClock({ minutes: 11, running }));

    await expect(
      getChallenge({ input: { timeZone: UTC }, planItemId: mockItem.id }),
    ).resolves.toMatchObject({ challenge: { blockId, status: "ready" }, status: "ready" });

    await expect(startMock({ blockId, input: {} })).resolves.toStrictEqual({ status: "ready" });

    const again = await runningMock(blockId);

    // Its number comes after the goal's finished mocks only: the one that ran out isn't one.
    expect({ number: again.number, status: again.status }).toStrictEqual({
      number: 1,
      status: "running",
    });

    expect(again.current?.drafts).toStrictEqual([]);
    expect(new Date(again.current?.deadline ?? 0).getTime()).toBeGreaterThan(Date.now());
  });

  it("leaves a mock taken any time out of the exam's entry, so a new one starts afresh", async () => {
    const { goal } = await scheduledMockSetup();
    const first = await startAnytime(goal.id);

    vi.setSystemTime(new Date(SESSION_NOW.getTime() + DAY_MS));

    await expect(getMockOptions({ goalId: goal.id })).resolves.toMatchObject({
      view: { running: null },
    });

    const again = await startAnytimeMock({
      goalId: goal.id,
      input: { acceptFewer: true, shape: first.shape },
    });

    expect(again).toMatchObject({ status: "started" });
    expect(again.status === "started" && again.id).not.toBe(first.id);

    await expect(getMock(first.id)).resolves.toMatchObject({ mock: { status: "expired" } });
  });

  it("keeps a placement mock, which the learner stops whenever they come back", async () => {
    const { goal } = await scheduledMockSetup();
    const { id } = await startAnytime(goal.id);

    // This goal's plan has no skill graph to build a placement mock from: the sitting says it is one.
    const sitting = await prisma.mockExam.findUniqueOrThrow({ where: { id } });
    const conditions = { ...mockConditionsSchema.parse(sitting.conditions), purpose: "placement" };
    await prisma.mockExam.update({ data: { conditions }, where: { id } });

    vi.setSystemTime(new Date(SESSION_NOW.getTime() + DAY_MS));

    await expect(getMock(id)).resolves.toMatchObject({ mock: { status: "running" } });

    await expect(finishMock({ blockId: id, input: {} })).resolves.toStrictEqual({
      status: "finished",
    });
  });
});
