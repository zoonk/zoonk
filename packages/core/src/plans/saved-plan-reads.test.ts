import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { memoryInsightFixture } from "@zoonk/testing/fixtures/memory";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { revalidateTag } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import { getLessonQuestion } from "../lesson-questions/get-lesson-question";
import { getCurrentMemoryInsight } from "../memory/insights/get-current-memory-insight";
import { getProgressView } from "../view-models/progress/get-progress-view";
import { getTodayView } from "../view-models/today/get-today-view";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { proposeChange } from "./_utils/apply-plan-change";
import * as changeComputation from "./_utils/compute-change";
import { loadPlanAtToken } from "./_utils/plan-token";
import { loadTodayPlanChange } from "./_utils/today-plan-change";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlan } from "./get-goal-plan";
import { getGoalResumePreview } from "./get-goal-resume-preview";
import * as planner from "./planner/build-plan";
import { previewPlanChange } from "./preview-plan-change";
import { refreshGoalPlan } from "./refresh-goal-plan";

const NOW = new Date("2020-09-28T12:00:00Z");

async function setup() {
  const [user, library] = await Promise.all([
    userFixture(),
    planLibraryFixture({ skills: [{ lessons: 8 }, { lessons: 8 }] }),
  ]);

  const { goal } = await unplannedGoalFixture({
    dailyMinutes: 20,
    details: { placementDeclined: true },
    settings: { startDate: "2020-09-28" },
    targetDate: new Date("2020-10-15"),
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);
  const context = await loadPlanAtToken(goal.id);

  if (!context) {
    throw new Error("Expected the plan");
  }

  const proposal = await proposeChange({
    approval: "always",
    context,
    operations: [{ kind: "setDailyMinutes", minutes: 5 }],
    reason: "A lighter routine",
    source: "memory",
  });

  expect(proposal.status).toBe("proposed");
  return { goal, user };
}

describe("saved plan reads", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("stores a proposal's preview at the saved plan version and local day", async () => {
    const { goal } = await setup();
    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

    const proposal = await prisma.planChange.findFirstOrThrow({
      where: { planId: plan.id, status: "proposed" },
    });

    expect(proposal.payload).toMatchObject({
      previewBasis: { planVersion: plan.version, studyDay: "2020-09-28", timeZone: "UTC" },
    });
  });

  it.each(["input token", "planning day"])(
    "keeps card text after the %s changes and hides only a stale Apply",
    async (changed) => {
      const { goal, user } = await setup();

      const proposal = await prisma.planChange.findFirstOrThrow({
        where: { plan: { goalId: goal.id }, status: "proposed" },
      });

      const question = await prisma.lessonQuestion.create({
        data: {
          answer: "A lighter routine",
          contextKind: "plan",
          contextSnapshot: {},
          goal: { connect: { id: goal.id } },
          planChange: { connect: { id: proposal.id } },
          question: "Can I study less?",
          requestFingerprint: "saved-preview",
          requestId: randomUUID(),
          status: "completed",
          thread: { create: { goalId: goal.id, kind: "plan", userId: user.id } },
        },
      });

      await memoryInsightFixture({
        goalId: goal.id,
        kind: "planChange",
        payload: {
          effect: { lessonsAdded: 999 },
          planChangeId: proposal.id,
          planChangeStatus: "proposed",
        },
        userId: user.id,
      });

      const before = await loadTodayPlanChange({ goal, now: new Date(), timeZone: "UTC" });
      expect(before?.id).toBe(proposal.id);

      await expect(getCurrentMemoryInsight({ goalId: goal.id })).resolves.toMatchObject({
        insight: { planChange: { effect: before?.effect, id: proposal.id } },
      });

      if (changed === "input token") {
        await prisma.$transaction((tx) =>
          markLearnerChanged(tx, { planInputs: true, userId: user.id }),
        );
      } else {
        vi.setSystemTime(new Date("2020-09-29T12:00:00Z"));
      }

      const build = vi.spyOn(planner, "buildPlan");
      const read = await getGoalPlan(goal.id);
      expect(read).toMatchObject({ status: "ready" });

      const canApply = changed === "input token";

      expect(
        read.status === "ready" && read.plan.changes.find((change) => change.id === proposal.id),
      ).toMatchObject({ canApply, id: proposal.id });

      await expect(
        loadTodayPlanChange({ goal, now: new Date(), timeZone: "UTC" }),
      ).resolves.toMatchObject({ canApply, id: proposal.id });

      await expect(getCurrentMemoryInsight({ goalId: goal.id })).resolves.toMatchObject({
        insight: { planChange: { canApply, id: proposal.id } },
      });

      await expect(getLessonQuestion({ questionId: question.id })).resolves.toMatchObject({
        question: { planChange: { canApply, id: proposal.id } },
        status: "ready",
      });

      expect(build).not.toHaveBeenCalled();
    },
  );

  it("R32 skips builds and writes when only an input token moved", async () => {
    const { goal, user } = await setup();

    await prisma.$transaction((tx) =>
      markLearnerChanged(tx, { planInputs: true, userId: user.id }),
    );

    const build = vi.spyOn(planner, "buildPlan");

    const refreshed = await countDatabaseStatements(() =>
      refreshGoalPlan({ goalId: goal.id, pace: "sampled" }),
    );

    expect(refreshed.result).toMatchObject({ status: "unchanged" });
    expect(build).toHaveBeenCalledTimes(0);
    expect(refreshed.writes).toBe(0);
  });

  it("does not quote the waiting time proposal a time write replaces", async () => {
    const { goal } = await setup();
    const quote = vi.spyOn(changeComputation, "computeChange");

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ kind: "setDailyMinutes", minutes: 15 }] },
      }),
    ).resolves.toMatchObject({ status: "applied" });

    expect(
      quote.mock.calls.filter(([input]) =>
        input.operations.some(
          (operation) => operation.kind === "setDailyMinutes" && operation.minutes === 5,
        ),
      ),
    ).toHaveLength(0);

    await expect(
      prisma.planChange.count({ where: { plan: { goalId: goal.id }, status: "replaced" } }),
    ).resolves.toBeGreaterThan(0);
  });

  it.each([0, 1])(
    "a preview POST leaves waiting quotes and tags untouched after %s days",
    async (days) => {
      const { goal } = await setup();
      vi.setSystemTime(new Date(NOW.getTime() + days * 86_400_000));

      const before = await prisma.planChange.findMany({
        orderBy: { id: "asc" },
        where: { plan: { goalId: goal.id } },
      });

      vi.mocked(revalidateTag).mockClear();

      await previewPlanChange({
        goalId: goal.id,
        input: { operations: [{ kind: "setDailyMinutes", minutes: 5 }], timeZone: "UTC" },
      });

      expect(revalidateTag).not.toHaveBeenCalled();

      await expect(
        prisma.planChange.findMany({
          orderBy: { id: "asc" },
          where: { plan: { goalId: goal.id } },
        }),
      ).resolves.toStrictEqual(before);
    },
  );

  it("excludes a previous session lesson that the saved plan dates today", async () => {
    const { goal, user } = await setup();

    const item = await prisma.planItem.findFirstOrThrow({
      orderBy: { position: "asc" },
      where: { lessonId: { not: null }, plan: { goalId: goal.id }, status: "todo" },
    });

    await prisma.planItem.update({
      data: { scheduledFor: new Date("2020-09-28") },
      where: { id: item.id },
    });

    const session = await studySessionFixture({
      goalId: goal.id,
      localDate: new Date("2020-09-21"),
      status: "active",
      userId: user.id,
    });

    await studySessionBlockFixture({
      kind: "learn",
      lessonId: item.lessonId,
      sessionId: session.id,
      status: "pending",
    });

    await expect(getTodayView({ goalId: goal.id })).resolves.toMatchObject({
      status: "ready",
      today: { earlierWork: [] },
    });
  });

  it.each([1, 7])("lists earlier unfinished saved work after %s missed days", async (days) => {
    const { goal } = await setup();
    vi.setSystemTime(new Date(NOW.getTime() + days * 86_400_000));

    const plan = await prisma.plan.findUniqueOrThrow({
      include: { items: { orderBy: { position: "asc" } } },
      where: { goalId: goal.id },
    });

    const earlier = plan.items.filter(
      (item) =>
        item.status === "todo" &&
        item.scheduledFor &&
        item.scheduledFor < new Date(new Date().toISOString().slice(0, 10)) &&
        (item.kind === "lesson" || item.kind === "chapter"),
    );

    expect(earlier.length).toBeGreaterThan(0);
    const today = await getTodayView({ goalId: goal.id });

    expect(today).toMatchObject({
      status: "ready",
      today: { earlierWork: earlier.map((item) => ({ id: item.id, title: item.titleSnapshot })) },
    });
  });

  it.each(["plan", "today", "device today", "progress", "proposal", "resume"])(
    "%s builds zero plans even after inputs and the day change",
    async (surface) => {
      const { goal, user } = await setup();

      await prisma.$transaction((tx) =>
        markLearnerChanged(tx, { planInputs: true, userId: user.id }),
      );

      if (surface === "resume") {
        await prisma.goal.update({ data: { status: "paused" }, where: { id: goal.id } });
      }

      vi.setSystemTime(new Date("2020-10-05T12:00:00Z"));

      const before = await prisma.plan.findUniqueOrThrow({
        include: { items: true },
        where: { goalId: goal.id },
      });

      const build = vi.spyOn(planner, "buildPlan");

      const readers = {
        "device today": () => getTodayView({ goalId: goal.id, timeZone: "Pacific/Kiritimati" }),
        plan: () => getGoalPlan(goal.id),
        progress: () => getProgressView({ goalId: goal.id }),
        proposal: () => loadTodayPlanChange({ goal, now: new Date(), timeZone: "UTC" }),
        resume: () => getGoalResumePreview(goal.id),
        today: () => getTodayView({ goalId: goal.id }),
      };

      await readers[surface as keyof typeof readers]();
      expect(build).not.toHaveBeenCalled();

      await expect(
        prisma.plan.findUniqueOrThrow({ include: { items: true }, where: { goalId: goal.id } }),
      ).resolves.toStrictEqual(before);
    },
  );
});
