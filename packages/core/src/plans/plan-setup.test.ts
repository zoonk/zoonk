import { selectRelevantMemoryFacts } from "@zoonk/ai/tasks/memory/relevance";
import { generateMemorySearchTerms } from "@zoonk/ai/tasks/memory/search-terms";
import { fitPlanToRoutineFacts } from "@zoonk/ai/tasks/plans/routine-fit";
import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { loadNoticeDay } from "../exams/_utils/notice-day";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { announceTestedOutItems } from "./announce-tested-out-items";
import { createGoalPlan } from "./create-goal-plan";
import {
  fitPlanToRoutine,
  runPlanSetupTask,
  searchRoutineMemory,
  selectRoutineMemory,
} from "./plan-setup";
import type * as NoticeDay from "../exams/_utils/notice-day";
import type * as Announcement from "./announce-tested-out-items";

// A database failure that lasts a moment can't be made safely with the real database, so these fail
// once on purpose.
vi.mock("./announce-tested-out-items", async (importOriginal) => {
  const actual = await importOriginal<typeof Announcement>();
  return { ...actual, announceTestedOutItems: vi.fn(actual.announceTestedOutItems) };
});

vi.mock("../exams/_utils/notice-day", async (importOriginal) => {
  const actual = await importOriginal<typeof NoticeDay>();
  return { ...actual, loadNoticeDay: vi.fn(actual.loadNoticeDay) };
});

/** A Monday in 2020, before other tests' learning events, so pace estimates don't move dates. */
const NOW = new Date("2020-09-28T12:00:00Z");
const TODAY = "2020-09-28";

const dropped = () => new Error("Connection terminated unexpectedly");

function mockFit(data: Awaited<ReturnType<typeof fitPlanToRoutineFacts>>["data"]) {
  vi.mocked(fitPlanToRoutineFacts).mockResolvedValue({
    data,
    provenance: {
      generatedAt: NOW.toISOString(),
      latencyMs: 1,
      model: "google/gemini-3.5-flash-lite",
      promptVersion: "test",
      provider: "google",
      requestedModel: "google/gemini-3.5-flash-lite",
      runId: "run-routine",
      usage: {},
    },
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

function mockLightWeek() {
  mockFit({
    operations: [{ kind: "addLightWeek", startDate: "2020-10-05" }],
    reason: "The week of October 5 is lighter, since you travel then.",
  });
}

async function routineGoal({ notes = 0 }: { notes?: number } = {}) {
  const user = await userFixture();

  const [library, unplanned] = await Promise.all([
    planLibraryFixture({ skills: [{ lessons: 4 }, { lessons: 3 }] }),
    unplannedGoalFixture({ dailyMinutes: 20, settings: { startDate: TODAY }, userId: user.id }),
    learningProfileFixture({ memoryEnabled: true, userId: user.id }),
    memoryFactFixture({
      category: "routine",
      statement: "Travels the week of October 5",
      userId: user.id,
    }),
    ...Array.from({ length: notes }, (_, index) =>
      memoryFactFixture({ category: "goals", statement: `Goal note ${index}`, userId: user.id }),
    ),
  ]);

  mockSession(user.id);
  return { ...unplanned, library };
}

async function placedGoal() {
  const user = await userFixture();
  const library = await planLibraryFixture({ skills: [{ lessons: 2 }, { lessons: 1 }] });

  const unplanned = await unplannedGoalFixture({
    dailyMinutes: 12,
    details: { answered: ["level", "placement"], level: "intermediate" },
    settings: { startDate: TODAY },
    userId: user.id,
  });

  await Promise.all(
    (["beginner", "intermediate"] as const).map((level, index) =>
      prisma.skill.update({ data: { level }, where: { id: library.skills[index]?.id } }),
    ),
  );

  const skillId = library.skills[0]?.id ?? "";
  const item = await itemFixture({ content: choiceItemContent(), skillId });
  await attemptFixture({ isCorrect: true, itemId: item.id, skillId, userId: user.id });

  mockSession(user.id);
  return { ...unplanned, library };
}

async function examInAnotherMonth() {
  const [user, blueprint, library] = await Promise.all([
    userFixture(),
    examBlueprintFixture({
      edition: {
        check: null,
        citations: [],
        dates: [
          {
            citation: { passage: "", sourceId: "notice" },
            date: "2020-11-08",
            kind: "exam",
            label: "Exam",
            startTime: null,
          },
        ],
        noticeUrl: null,
        questionCount: null,
        sourceHash: null,
        timeZone: null,
        year: 2020,
      },
    }),
    planLibraryFixture({ skills: [{ lessons: 1 }, { lessons: 1 }] }),
  ]);

  const unplanned = await unplannedGoalFixture({
    details: { examMonth: 12, examName: "Test Exam", examYear: 2020 },
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: { startDate: TODAY },
    userId: user.id,
  });

  mockSession(user.id);
  return { ...unplanned, library };
}

async function readSetupTasks(planId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  return plan.setupTasks;
}

describe(runPlanSetupTask, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.mocked(fitPlanToRoutineFacts).mockReset();

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: new Date(`${TODAY}T00:00:00Z`),
      currentInstant: NOW,
      timeZone: "UTC",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("leaves a new plan's whole setup owed for the goal's run, with no model call", async () => {
    const { goal, library, plan } = await routineGoal();

    await expect(createGoalPlan({ goalId: goal.id, graph: library.graph })).resolves.toStrictEqual({
      setupTasks: ["placement", "routine"],
      status: "created",
    });

    await expect(readSetupTasks(plan.id)).resolves.toStrictEqual(["placement", "routine"]);
    await expect(prisma.planChange.count({ where: { planId: plan.id } })).resolves.toBe(0);
    expect(generateMemorySearchTerms).not.toHaveBeenCalled();
    expect(fitPlanToRoutineFacts).not.toHaveBeenCalled();
  });

  it("fits a new plan to the routine once: a failed fit throws for its retry, and a retry after the fit changes nothing", async () => {
    const { goal, library, plan } = await routineGoal();
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const search = await searchRoutineMemory(goal.id);
    expect(search).toStrictEqual({ memory: ["Travels the week of October 5"] });
    const memory = search && "memory" in search ? search.memory : [];

    vi.mocked(fitPlanToRoutineFacts).mockRejectedValueOnce(new Error("The provider is overloaded"));

    await expect(fitPlanToRoutine({ goalId: goal.id, memory })).rejects.toThrow(
      "The provider is overloaded",
    );

    await expect(readSetupTasks(plan.id)).resolves.toContain("routine");

    mockLightWeek();
    await fitPlanToRoutine({ goalId: goal.id, memory });
    await fitPlanToRoutine({ goalId: goal.id, memory });

    const changes = await prisma.planChange.findMany({ where: { planId: plan.id } });

    expect(changes).toMatchObject([
      { reason: "The week of October 5 is lighter, since you travel then.", status: "applied" },
    ]);

    expect(fitPlanToRoutineFacts).toHaveBeenCalledTimes(2);
    await expect(readSetupTasks(plan.id)).resolves.toStrictEqual(["placement"]);
    await expect(searchRoutineMemory(goal.id)).resolves.toBeNull();
  });

  it("searches a large memory in two calls, each throwing for its retry instead of falling back", async () => {
    const { goal, library, plan } = await routineGoal({ notes: 10 });
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    vi.mocked(generateMemorySearchTerms).mockRejectedValueOnce(new Error("Gateway down"));
    await expect(searchRoutineMemory(goal.id)).rejects.toThrow("Gateway down");

    vi.mocked(generateMemorySearchTerms).mockResolvedValueOnce({
      data: { terms: ["travel"] },
    } as Awaited<ReturnType<typeof generateMemorySearchTerms>>);

    await expect(searchRoutineMemory(goal.id)).resolves.toStrictEqual({ terms: ["travel"] });

    vi.mocked(selectRelevantMemoryFacts).mockRejectedValueOnce(new Error("Gateway down"));

    await expect(selectRoutineMemory({ goalId: goal.id, terms: ["travel"] })).rejects.toThrow(
      "Gateway down",
    );

    vi.mocked(selectRelevantMemoryFacts).mockImplementationOnce(async ({ facts }) =>
      facts.filter((fact) => fact.statement.startsWith("Travels")),
    );

    const memory = await selectRoutineMemory({ goalId: goal.id, terms: ["travel"] });
    expect(memory).toStrictEqual(["Travels the week of October 5"]);

    mockLightWeek();
    await fitPlanToRoutine({ goalId: goal.id, memory });

    expect(fitPlanToRoutineFacts).toHaveBeenCalledWith(expect.objectContaining({ memory }));
    await expect(readSetupTasks(plan.id)).resolves.toStrictEqual(["placement"]);
  });

  it("tests out what placement settled once: a failed announcement is retried with what the failed attempt tested out", async () => {
    const { goal, library, plan } = await placedGoal();
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    vi.mocked(announceTestedOutItems).mockRejectedValueOnce(dropped());

    await expect(runPlanSetupTask({ goalId: goal.id, task: "placement" })).rejects.toThrow(
      "Connection terminated unexpectedly",
    );

    await runPlanSetupTask({ goalId: goal.id, task: "placement" });
    await runPlanSetupTask({ goalId: goal.id, task: "placement" });

    const [testedOut, announced] = await Promise.all([
      prisma.planItem.findMany({ where: { planId: plan.id, status: "testedOut" } }),
      prisma.planChange.findMany({ where: { kind: "testedOut", planId: plan.id } }),
    ]);

    expect(testedOut.map((item) => item.skillId)).toStrictEqual([
      library.skills[0]?.id,
      library.skills[0]?.id,
    ]);

    expect(announced).toHaveLength(1);

    expect(announced[0]?.payload).toMatchObject({
      planItemIds: expect.arrayContaining(testedOut.map((item) => item.id)),
    });

    await expect(readSetupTasks(plan.id)).resolves.toStrictEqual(["routine"]);
  });

  it("asks about the notice's day once: a failed ask is retried, and a retry after it asks nothing", async () => {
    const { goal, library, plan } = await examInAnotherMonth();

    await expect(createGoalPlan({ goalId: goal.id, graph: library.graph })).resolves.toMatchObject({
      setupTasks: ["placement", "routine", "notice"],
    });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      targetDate: new Date("2020-12-01T00:00:00Z"),
    });

    vi.mocked(loadNoticeDay).mockRejectedValueOnce(dropped());

    await expect(runPlanSetupTask({ goalId: goal.id, task: "notice" })).rejects.toThrow(
      "Connection terminated unexpectedly",
    );

    await runPlanSetupTask({ goalId: goal.id, task: "notice" });
    await runPlanSetupTask({ goalId: goal.id, task: "notice" });

    const changes = await prisma.planChange.findMany({ where: { planId: plan.id } });

    expect(changes).toMatchObject([
      {
        payload: {
          operations: [{ estimated: false, kind: "setNoticeDate", targetDate: "2020-11-08" }],
        },
        status: "proposed",
      },
    ]);

    await expect(readSetupTasks(plan.id)).resolves.toStrictEqual(["placement", "routine"]);
  });
});
