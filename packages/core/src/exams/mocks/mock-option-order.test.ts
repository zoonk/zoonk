import { prisma } from "@zoonk/db";
import { choiceItemContent } from "@zoonk/testing/fixtures/skills";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_NOW } from "../../sessions/_test-utils/session-goal";
import { runningMock, scheduledMockSetup } from "./_test-utils/scheduled-mock";
import { finishMock } from "./finish-mock";
import { getMock } from "./get-mock";
import { mockConditionsSchema } from "./mock-contract";
import { saveMockAnswer } from "./save-mock-answer";
import { startMock } from "./start-mock";

const STORED_ORDER = choiceItemContent().options.map((option) => option.text);
const RIGHT = "Right answer";

async function startedMock() {
  const setup = await scheduledMockSetup();
  await startMock({ blockId: setup.blockId, input: {} });
  const mock = await prisma.mockExam.findUniqueOrThrow({ where: { blockId: setup.blockId } });
  return { ...setup, mock };
}

function save({
  blockId,
  itemId,
  selectedIndex,
}: Record<"blockId" | "itemId", string> & { selectedIndex: number }) {
  return saveMockAnswer({
    blockId,
    input: { answer: { selectedIndex }, durationMs: 30_000, flagged: false, itemId },
  });
}

/** Hands the mock in; its review lists only the questions not answered right. */
async function handIn(blockId: string) {
  await finishMock({ blockId, input: {} });
  const finished = await getMock(blockId);

  if (finished.status !== "ready") {
    throw new Error("Expected the finished mock");
  }

  const { result, review } = finished.mock;

  return {
    correct: result?.correct,
    review: new Map(review.map((entry) => [entry.itemId, entry])),
  };
}

describe("the order a mock shows each question's options in", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is the mock's own, never the stored one, and a tap is graded where it showed the option", async () => {
    const { blockId, mock } = await startedMock();

    expect(mockConditionsSchema.parse(mock.conditions).shufflesOptions).toBe(true);

    const [shown, again] = await Promise.all([runningMock(blockId), runningMock(blockId)]);
    const questions = shown.current?.questions ?? [];
    const reread = again.current?.questions ?? [];

    expect(reread.map((question) => question.options)).toStrictEqual(
      questions.map((question) => question.options),
    );

    for (const question of questions) {
      expect(question.options).not.toStrictEqual(STORED_ORDER);
      expect(question.options?.toSorted()).toStrictEqual(STORED_ORDER.toSorted());
    }

    const [tapped, moved] = [
      questions[0],
      questions.slice(1).find((question) => question.options?.[0] !== RIGHT),
    ];

    if (!tapped || !moved) {
      throw new Error("Expected a question whose right option moved off the first place");
    }

    await save({
      blockId,
      itemId: tapped.itemId,
      selectedIndex: tapped.options?.indexOf(RIGHT) ?? -1,
    });

    await save({ blockId, itemId: moved.itemId, selectedIndex: 0 });

    const { correct, review } = await handIn(blockId);

    expect(correct).toBe(1);
    expect(review.has(tapped.itemId)).toBe(false);

    expect(review.get(moved.itemId)).toMatchObject({
      learnerAnswer: moved.options?.[0],
      outcome: "wrong",
    });
  });

  it("stays the stored one on a mock started before mocks had their own, so its saved answers grade as they did", async () => {
    const { blockId, mock } = await startedMock();
    const { shufflesOptions: _, ...before } = mockConditionsSchema.parse(mock.conditions);

    await prisma.mockExam.update({ data: { conditions: before }, where: { id: mock.id } });

    const running = await runningMock(blockId);
    const questions = running.current?.questions ?? [];
    const [right, wrong] = questions;

    for (const question of questions) {
      expect(question.options).toStrictEqual(STORED_ORDER);
    }

    if (!right || !wrong) {
      throw new Error("Expected two questions");
    }

    await save({ blockId, itemId: right.itemId, selectedIndex: STORED_ORDER.indexOf(RIGHT) });
    await save({ blockId, itemId: wrong.itemId, selectedIndex: 1 });

    const { correct, review } = await handIn(blockId);

    expect(correct).toBe(1);
    expect(review.has(right.itemId)).toBe(false);

    expect(review.get(wrong.itemId)).toMatchObject({
      learnerAnswer: STORED_ORDER[1],
      outcome: "wrong",
    });
  });
});
