import { fitPlanToRoutineFacts } from "@zoonk/ai/tasks/v2/plans/routine-fit";
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
import { runPlanSetupTask } from "./plan-setup";
import type * as NoticeDay from "../exams/_utils/notice-day";
import type * as Announcement from "./announce-tested-out-items";

// A database read or write that fails for a moment (a dropped connection) can't be made safely
// with the real database: tests make the placement's announcement and the notice's day fail once.
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

/** Only a light week: the week's minutes stay as they were, so nothing in them says it was fitted. */
function mockLightWeek() {
  mockFit({
    operations: [{ kind: "addLightWeek", startDate: "2020-10-05" }],
    reason: "The week of October 5 is lighter, since you travel then.",
  });
}

/** A learner whose memory holds their routine, with a goal whose plan the planner hasn't built. */
async function routineGoal() {
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
  ]);

  mockSession(user.id);
  return { ...unplanned, library };
}

/** A goal whose learner ended placement before its plan existed, at a level past the first skill. */
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

  // Placement settled the first skill with a right answer of its own (an item, no step): the
  // stated level alone would only leave it to confirm.
  const skillId = library.skills[0]?.id ?? "";
  const item = await itemFixture({ content: choiceItemContent(), skillId });
  await attemptFixture({ isCorrect: true, itemId: item.id, skillId, userId: user.id });

  mockSession(user.id);
  return { ...unplanned, library };
}

/** An exam the learner said is in December, whose stored notice sets it for November. */
async function examInAnotherMonth() {
  const [user, blueprint, library] = await Promise.all([
    userFixture(),
    examBlueprintFixture({
      edition: {
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

  it("leaves a new plan's setup to the caller's steps, and owes each task until it has run", async () => {
    const { goal, library, plan } = await routineGoal();

    await expect(
      createGoalPlan({ goalId: goal.id, graph: library.graph, setup: "steps" }),
    ).resolves.toStrictEqual({ setupTasks: ["placement", "routine"], status: "created" });

    await expect(readSetupTasks(plan.id)).resolves.toStrictEqual(["placement", "routine"]);
    expect(fitPlanToRoutineFacts).not.toHaveBeenCalled();
  });

  it("fits a new plan to the routine once: a failed call is retried, and a retry after the fit changes nothing", async () => {
    const { goal, library, plan } = await routineGoal();
    await createGoalPlan({ goalId: goal.id, graph: library.graph, setup: "steps" });

    vi.mocked(fitPlanToRoutineFacts).mockRejectedValueOnce(new Error("The provider is overloaded"));

    await expect(runPlanSetupTask({ goalId: goal.id, task: "routine" })).rejects.toThrow(
      "The provider is overloaded",
    );

    await expect(readSetupTasks(plan.id)).resolves.toContain("routine");

    mockLightWeek();
    await runPlanSetupTask({ goalId: goal.id, task: "routine" });
    await runPlanSetupTask({ goalId: goal.id, task: "routine" });

    const changes = await prisma.planChange.findMany({ where: { planId: plan.id } });

    expect(changes).toMatchObject([
      { reason: "The week of October 5 is lighter, since you travel then.", status: "applied" },
    ]);

    expect(fitPlanToRoutineFacts).toHaveBeenCalledTimes(2);
    await expect(readSetupTasks(plan.id)).resolves.toStrictEqual(["placement"]);
  });

  it("tests out what placement settled once: a failed announcement is retried with what the failed attempt tested out", async () => {
    const { goal, library, plan } = await placedGoal();
    await createGoalPlan({ goalId: goal.id, graph: library.graph, setup: "steps" });

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

    // One announcement, with its undo, for both lessons the failed attempt tested out.
    expect(announced).toHaveLength(1);

    expect(announced[0]?.payload).toMatchObject({
      planItemIds: expect.arrayContaining(testedOut.map((item) => item.id)),
    });

    await expect(readSetupTasks(plan.id)).resolves.toStrictEqual(["routine"]);
  });

  // The plan counts down to the month the learner named until they answer the notice's day on
  // Today, never replacing it silently.
  it("asks about the notice's day once: a failed ask is retried, and a retry after it asks nothing", async () => {
    const { goal, library, plan } = await examInAnotherMonth();

    await expect(
      createGoalPlan({ goalId: goal.id, graph: library.graph, setup: "steps" }),
    ).resolves.toMatchObject({ setupTasks: ["placement", "routine", "notice"] });

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

  it("sets up a plan a request builds in that request, and leaves a task that failed there to the next run", async () => {
    const { goal, library, plan } = await routineGoal();
    vi.mocked(fitPlanToRoutineFacts).mockRejectedValueOnce(new Error("The provider is overloaded"));

    // Placement has nothing to apply here; the routine's fit fails and is still owed.
    await expect(createGoalPlan({ goalId: goal.id, graph: library.graph })).resolves.toStrictEqual({
      setupTasks: ["routine"],
      status: "created",
    });

    mockLightWeek();
    await runPlanSetupTask({ goalId: goal.id, task: "routine" });

    await expect(
      prisma.planChange.count({ where: { planId: plan.id, status: "applied" } }),
    ).resolves.toBe(1);

    await expect(readSetupTasks(plan.id)).resolves.toStrictEqual([]);
  });
});
