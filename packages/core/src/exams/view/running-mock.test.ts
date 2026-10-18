import { prisma } from "@zoonk/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DAY_MS, SESSION_NOW } from "../../sessions/_test-utils/session-goal";
import { MINUTE_MS, answerRight, scheduledMockSetup } from "../mocks/_test-utils/scheduled-mock";
import { getMockOptions } from "../mocks/get-mock-options";
import { mockConditionsSchema } from "../mocks/mock-contract";
import { startAnytimeMock } from "../mocks/start-anytime-mock";
import { startMock } from "../mocks/start-mock";
import { getExamView } from "./get-exam-view";

async function examOf(goalId: string) {
  const result = await getExamView({ goalId });

  if (result.status !== "ready") {
    throw new Error(`Expected the exam, got ${result.status}`);
  }

  return result.exam;
}

/** Starts the goal's first mock to take any time, on the questions its bank has. */
async function startAnytime(goalId: string) {
  const options = await getMockOptions({ goalId });
  const option = options.status === "ready" ? options.view.options[0] : undefined;

  if (!option) {
    throw new Error("Expected a mock to take any time");
  }

  const shape = { area: option.area, day: option.day, kind: option.kind };

  const started = await startAnytimeMock({
    goalId,
    input: { acceptFewer: true, shape, timeZone: "UTC" },
  });

  if (started.status !== "started") {
    throw new Error(`Expected a started mock, got ${started.status}`);
  }

  return { id: started.id, shape };
}

// Ana's mock (4 of 45 answered) showed on the exam's page only as "Continue your mock exam".
describe("the exam's running mock", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is the plan's weekly mock once started, with what's answered and its clock, listed once", async () => {
    const { blockId, goal, mockItem } = await scheduledMockSetup();

    await expect(examOf(goal.id)).resolves.toMatchObject({
      nextMock: { planItemId: mockItem.id },
      runningMocks: [],
    });

    await startMock({ blockId, input: {} });
    const running = await answerRight({ blockId, count: 2 });
    const exam = await examOf(goal.id);

    expect(exam.runningMocks).toStrictEqual([
      {
        answered: 2,
        deadline: running.current?.deadline,
        id: blockId,
        number: 1,
        purpose: "planned",
        questions: running.current?.questions.length,
        shape: null,
      },
    ]);

    expect(exam.nextMock).toBeNull();
  });

  it("is a mock taken any time, by its own id and what it sits, beside the plan's next one", async () => {
    const { goal, mockItem } = await scheduledMockSetup();
    const { id, shape } = await startAnytime(goal.id);
    await answerRight({ blockId: id, count: 1 });

    await expect(examOf(goal.id)).resolves.toMatchObject({
      nextMock: { planItemId: mockItem.id },
      runningMocks: [{ answered: 1, id, number: 1, purpose: "practice", shape }],
    });
  });

  it("lists the one the page's main action continues first, then the weekly one beside it", async () => {
    const { blockId, goal } = await scheduledMockSetup();
    const { id } = await startAnytime(goal.id);

    // The weekly mock starts later, so it's the newer one.
    vi.setSystemTime(new Date(SESSION_NOW.getTime() + MINUTE_MS));
    await expect(startMock({ blockId, input: {} })).resolves.toStrictEqual({ status: "ready" });

    // The weekly one opens its own sitting, wherever its day's block is now.
    await expect(examOf(goal.id)).resolves.toMatchObject({
      nextMock: null,
      runningMocks: [
        { id, purpose: "practice" },
        { id: blockId, purpose: "planned" },
      ],
    });
  });

  it("has no clock left once every section is handed in and it waits to be graded", async () => {
    const { goal } = await scheduledMockSetup();
    const { id } = await startAnytime(goal.id);
    const mock = await prisma.mockExam.findUniqueOrThrow({ where: { id } });
    const { sections } = mockConditionsSchema.parse(mock.conditions);

    await prisma.mockExam.update({ data: { sectionIndex: sections.length }, where: { id } });

    await expect(examOf(goal.id)).resolves.toMatchObject({
      runningMocks: [{ deadline: null, id }],
    });
  });

  it("isn't one whose time ran out while the learner was away", async () => {
    const { goal } = await scheduledMockSetup();
    const { id } = await startAnytime(goal.id);
    await answerRight({ blockId: id, count: 1 });

    vi.setSystemTime(new Date(SESSION_NOW.getTime() + 3 * DAY_MS));

    await expect(examOf(goal.id)).resolves.toMatchObject({ runningMocks: [] });
  });
});
