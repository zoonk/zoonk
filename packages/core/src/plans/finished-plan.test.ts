import { type PlanItemKind, prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getChallenge } from "../checkpoints/get-challenge";
import { getGoalPreparation } from "../preparation/get-goal-preparation";
import { getFieldMapView } from "../view-models/map/get-field-map-view";
import { getPlanTabView } from "../view-models/plan/get-plan-view";
import { getSyllabusView } from "../view-models/syllabus/get-syllabus-view";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";

/** A Monday in 2020, before the learning events other tests write. */
const START = new Date("2020-09-28T12:00:00Z");

const DATE = new Date("2020-10-07T00:00:00Z");

const DAY_AFTER = new Date("2020-10-08T12:00:00Z");

const SIZES = [8, 8, 8, 4];

async function readPlan() {
  const result = await getPlanTabView();
  return result.status === "ready" ? result.view.plan : null;
}

function checkpointTimings(view: Awaited<ReturnType<typeof readPlan>>) {
  return view?.phases.map((phase) => phase.checkpoint?.when);
}

function checkpointIds(view: Awaited<ReturnType<typeof readPlan>>) {
  return view?.phases.map((phase) => phase.checkpoint?.planItemId);
}

async function readLessons() {
  const result = await getSyllabusView();
  return result.status === "ready" ? result.syllabus.lessons : null;
}

async function readTodayStatus(goalId: string) {
  const result = await getGoalPreparation(goalId);
  return result.status === "ready" ? result.preparation.status : null;
}

async function readNext() {
  const result = await getFieldMapView();
  return result.status === "ready" ? result.map.next : null;
}

async function readChallengeStatus(planItemId: string) {
  const result = await getChallenge({ input: {}, planItemId });
  return result.status === "ready" ? result.challenge.status : null;
}

async function readMapPhaseStates() {
  const result = await getFieldMapView();
  return result.status === "ready" ? result.map.phases.map((phase) => phase.state) : null;
}

async function finish(planId: string, kinds: PlanItemKind[]) {
  await prisma.planItem.updateMany({
    data: { completedAt: new Date(), status: "done" },
    where: { kind: { in: kinds }, planId, status: "todo" },
  });
}

async function shortLearnGoal(targetDate = DATE) {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: SIZES.map((_, index) => `Phase ${index + 1}`),
    skills: SIZES.map((lessons, index) => ({ area: `Area ${index + 1}`, lessons, phase: index })),
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 24,
    details: { placementDeclined: true },
    kind: "learn",
    settings: { startDate: "2020-09-28" },
    targetDate,
    timezone: "UTC",
    userId: user.id,
  });

  await Promise.all([
    createGoalPlan({ goalId: goal.id, graph: library.graph }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  mockSession(user.id);

  const lessons = await prisma.planItem.count({ where: { kind: "lesson", planId: plan.id } });
  const challenges = await prisma.planItem.count({ where: { kind: "boss", planId: plan.id } });

  return { challenges, goal, lessons, plan };
}

describe("a finished plan", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("finishes a dated learn plan before its date without waiting for practice reviews", async () => {
    const { challenges, goal, plan } = await shortLearnGoal(new Date("2020-10-28T00:00:00Z"));

    const reviews = await prisma.planItem.findMany({
      where: { kind: "review", planId: plan.id, status: "todo" },
    });

    expect(reviews.length).toBeGreaterThan(0);
    await finish(plan.id, ["chapter", "lesson"]);

    await expect(readPlan()).resolves.toMatchObject({
      status: { challenges, kind: "challengesLeft" },
    });

    await expect(readTodayStatus(goal.id)).resolves.toStrictEqual({
      challenges,
      kind: "challengesLeft",
    });

    await expect(readNext()).resolves.toBeNull();

    await prisma.planItem.updateMany({
      data: { scheduledFor: new Date("2020-10-29T00:00:00Z") },
      where: { kind: { in: ["boss", "review"] }, planId: plan.id, status: "todo" },
    });

    vi.setSystemTime(new Date("2020-10-29T12:00:00Z"));

    await expect(readPlan()).resolves.toMatchObject({
      status: { challenges, kind: "challengesLeft" },
    });

    vi.setSystemTime(START);
    await finish(plan.id, ["boss"]);
    const view = await readPlan();

    expect(view).toMatchObject({ end: { kind: "finished" }, status: { kind: "finished" } });
    expect(view?.phases.every((phase) => phase.state === "done")).toBe(true);
    await expect(readTodayStatus(goal.id)).resolves.toStrictEqual({ kind: "finished" });

    await expect(readMapPhaseStates()).resolves.toStrictEqual(
      view?.phases.map((phase) => phase.state),
    );

    await expect(
      prisma.planItem.count({ where: { kind: "review", planId: plan.id, status: "todo" } }),
    ).resolves.toBe(reviews.length);
  });

  it("keeps an exam's reviews and mocks as closing work after its lessons and challenges", async () => {
    const { goal, plan } = await shortLearnGoal(new Date("2020-10-28T00:00:00Z"));
    await prisma.goal.update({ data: { kind: "exam" }, where: { id: goal.id } });
    await finish(plan.id, ["chapter", "lesson", "boss"]);

    const before = await readPlan();
    const todayStatus = await readTodayStatus(goal.id);

    expect(before?.end).toBeNull();
    expect(before?.status?.kind).not.toBe("finished");
    expect(todayStatus?.kind).not.toBe("finished");

    await finish(plan.id, ["review"]);

    await prisma.planItem.create({
      data: {
        kind: "mock",
        phase: 3,
        planId: plan.id,
        position: 1000,
        scheduledFor: DATE,
        status: "todo",
        titleSnapshot: "Exam rehearsal",
      },
    });

    await expect(readPlan()).resolves.toMatchObject({ end: null });
    await finish(plan.id, ["mock"]);

    await expect(readPlan()).resolves.toMatchObject({ status: { kind: "finished" } });
    await expect(readTodayStatus(goal.id)).resolves.toStrictEqual({ kind: "finished" });
  });

  it("counts the lessons the plan chose, so finishing them reads 100%", async () => {
    const { goal, lessons, plan } = await shortLearnGoal();

    expect(lessons).toBeLessThan(SIZES.reduce((sum, size) => sum + size, 0));
    await expect(readLessons()).resolves.toStrictEqual({ done: 0, known: 0, total: lessons });

    await finish(plan.id, ["chapter", "lesson", "boss"]);

    await expect(readLessons()).resolves.toStrictEqual({ done: lessons, known: 0, total: lessons });

    const view = await readPlan();

    expect(view?.status).toStrictEqual({ kind: "finished" });
    expect(view?.end).toStrictEqual({ kind: "finished" });
    expect(view?.phases.every((phase) => phase.state === "done")).toBe(true);
    await expect(readTodayStatus(goal.id)).resolves.toStrictEqual({ kind: "finished" });

    await expect(readMapPhaseStates()).resolves.toStrictEqual(
      view?.phases.map((phase) => phase.state),
    );
  });

  it("isn't finished while a phase's challenge is left: it says how many", async () => {
    const { challenges, goal, lessons, plan } = await shortLearnGoal();

    expect(challenges).toBeGreaterThan(1);

    await finish(plan.id, ["chapter", "lesson"]);

    await expect(readLessons()).resolves.toStrictEqual({ done: lessons, known: 0, total: lessons });

    const beforeDue = await readPlan();
    expect(beforeDue?.status).toStrictEqual({ challenges, kind: "challengesLeft" });
    expect(beforeDue?.end).toBeNull();

    expect(checkpointTimings(beforeDue)).toStrictEqual(
      Array.from({ length: challenges }, () => "date"),
    );

    const bosses = await prisma.planItem.findMany({
      orderBy: { position: "asc" },
      where: { kind: "boss", planId: plan.id },
    });

    const [first, second] = bosses;

    if (!first?.scheduledFor || !second?.scheduledFor) {
      throw new Error("Expected the real plan's first two dated challenges");
    }

    await expect(readChallengeStatus(first.id)).resolves.toBe("upcoming");
    vi.setSystemTime(new Date(first.scheduledFor.getTime() + 12 * 60 * 60 * 1000));

    const view = await readPlan();

    expect(view?.status).toStrictEqual({ challenges, kind: "challengesLeft" });
    expect(view?.end).toBeNull();
    expect(view?.phases.some((phase) => phase.state === "done")).toBe(false);

    expect(checkpointTimings(view)).toStrictEqual(
      Array.from({ length: challenges }, (_, index) => (index === 0 ? "nextSession" : "date")),
    );

    expect(checkpointIds(view)).toStrictEqual(bosses.map((boss) => boss.id));
    await expect(readChallengeStatus(first.id)).resolves.toBe("ready");
    await expect(readChallengeStatus(second.id)).resolves.toBe("upcoming");

    await expect(readTodayStatus(goal.id)).resolves.toStrictEqual(view?.status);
    await expect(readNext()).resolves.toBeNull();

    await expect(readMapPhaseStates()).resolves.toStrictEqual(
      view?.phases.map((phase) => phase.state),
    );

    await prisma.planItem.update({
      data: { completedAt: new Date(), status: "done" },
      where: { id: first.id },
    });

    vi.setSystemTime(new Date(second.scheduledFor.getTime() + 12 * 60 * 60 * 1000));

    const after = await readPlan();

    expect(after?.status).toStrictEqual({ challenges: challenges - 1, kind: "challengesLeft" });
    expect(after?.phases.filter((phase) => phase.state === "done")).toHaveLength(1);
    expect(after?.phases[1]?.checkpoint?.when).toBe("nextSession");
    expect(after?.phases[2]?.checkpoint?.when).toBe("date");
    await expect(readChallengeStatus(second.id)).resolves.toBe("ready");
  });

  it("says the challenges left after its date too, never that it needs adjusting", async () => {
    const { challenges, plan } = await shortLearnGoal();

    await finish(plan.id, ["chapter", "lesson"]);

    await prisma.planItem.updateMany({
      data: { scheduledFor: new Date("2020-10-08T00:00:00Z") },
      where: { kind: "boss", planId: plan.id },
    });

    vi.setSystemTime(DAY_AFTER);

    const view = await readPlan();

    expect(view).toMatchObject({ end: null, status: { challenges, kind: "challengesLeft" } });

    expect(view?.phases.flatMap((phase) => phase.checkpoint?.when ?? [])).toStrictEqual(
      Array.from({ length: challenges }, () => "nextSession"),
    );
  });

  it("never reads a phase the plan holds nothing of as done", async () => {
    const { plan } = await shortLearnGoal(new Date("2020-09-30T00:00:00Z"));

    const before = await readPlan();
    const leftOut = before?.phases.filter((phase) => phase.state === "leftOut") ?? [];

    expect(leftOut.length).toBeGreaterThan(0);
    expect(leftOut.every((phase) => phase.lessonsTotal === 0 && !phase.checkpoint)).toBe(true);

    await expect(readMapPhaseStates()).resolves.toStrictEqual(
      before?.phases.map((phase) => phase.state),
    );

    await finish(plan.id, ["boss", "chapter", "checkpoint", "lesson", "review"]);

    const after = await readPlan();

    expect(after?.status).toStrictEqual({ kind: "finished" });

    expect(after?.phases.map((phase) => phase.state)).toStrictEqual(
      before?.phases.map((phase) => (phase.state === "leftOut" ? "leftOut" : "done")),
    );

    await expect(readMapPhaseStates()).resolves.toStrictEqual(
      after?.phases.map((phase) => phase.state),
    );
  });
});
