import { prisma } from "@zoonk/db";
import { markPlanInputsChanged } from "@zoonk/db/learner-writes";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHook, sleep } from "workflow";
import { start } from "workflow/api";
import * as plannerLessons from "../../../../../packages/core/src/plans/_utils/planner-lessons";
import { buildPlan } from "../../../../../packages/core/src/plans/planner/build-plan";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { sessionPreparationWorkflow } from "./session-preparation-workflow";

vi.mock("../../../../../packages/core/src/plans/planner/build-plan", { spy: true });

const TODAY = new Date("2026-09-30T00:00:00Z");

async function sessionWithLesson() {
  const user = await userFixture();

  const goal = await goalFixture({
    details: { placementDeclined: true },
    timezone: "UTC",
    userId: user.id,
  });

  const [plan, session, lesson] = await Promise.all([
    planFixture({ goalId: goal.id, phases: [] }),
    studySessionFixture({ goalId: goal.id, localDate: TODAY, userId: user.id }),
    libraryLessonFixture(),
  ]);

  const item = await planItemFixture({ lessonId: lesson.id, planId: plan.id, scheduledFor: TODAY });

  await studySessionBlockFixture({ lessonId: lesson.id, sessionId: session.id });

  return { goal, item, lesson, plan, user };
}

describe("session preparation records admission for its children", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("publishes one parent manifest for the selected children without a planner entry", async () => {
    const { goal, item, lesson, plan, user } = await sessionWithLesson();
    vi.mocked(buildPlan).mockClear();

    const result = await sessionPreparationWorkflow({
      goalId: goal.id,
      timeZone: "UTC",
      userId: user.id,
    });

    expect(result).toMatchObject({ lessonIds: [lesson.id], status: "prepared" });

    expect(start).toHaveBeenCalledWith(lessonContentWorkflow, [
      expect.objectContaining({
        lessonId: lesson.id,
        planGoalId: goal.id,
        planManifest: expect.objectContaining({
          basis: expect.objectContaining({
            inputVersion: plan.inputVersion,
            planId: plan.id,
            planVersion: plan.version,
          }),
          goalId: goal.id,
          targets: [expect.objectContaining({ lessonId: lesson.id, sourceItemIds: [item.id] })],
        }),
      }),
    ]);

    expect(buildPlan).not.toHaveBeenCalled();

    await expect(prisma.lesson.findUnique({ where: { id: lesson.id } })).resolves.toMatchObject({
      contentStatus: "pending",
    });
  });

  it("starts the session's lessons once other runs' writes stop moving the plan, letting the token go meanwhile", async () => {
    const { goal, lesson, plan, user } = await sessionWithLesson();

    const skill = await skillFixture();
    await planItemFixture({ planId: plan.id, skillId: skill.id });

    const load = plannerLessons.loadGoalPlannerLessons;

    const markWhileReading = async (input: Parameters<typeof load>[0]) => {
      await prisma.$transaction((tx) => markPlanInputsChanged(tx, { userIds: [user.id] }));
      return load(input);
    };

    vi.spyOn(plannerLessons, "loadGoalPlannerLessons")
      .mockImplementationOnce(markWhileReading)
      .mockImplementationOnce(markWhileReading);

    const held = new Set<string>();
    const heldWhileWaiting: boolean[] = [];

    vi.mocked(createHook).mockImplementation((options) => {
      const token = options?.token ?? "generated-token";
      const release = () => held.delete(token);
      held.add(token);

      return {
        [Symbol.dispose]: release,
        dispose: release,
        getConflict: () => Promise.resolve(null),
        token,
      } as unknown as ReturnType<typeof createHook>;
    });

    vi.mocked(sleep).mockImplementation(async () => {
      heldWhileWaiting.push(held.has(`session-prep:${user.id}`));
      expect(start).not.toHaveBeenCalledWith(lessonContentWorkflow, expect.anything());
    });

    await expect(
      sessionPreparationWorkflow({ goalId: goal.id, timeZone: "UTC", userId: user.id }),
    ).resolves.toMatchObject({ lessonIds: [lesson.id], status: "prepared" });

    expect(start).toHaveBeenCalledWith(lessonContentWorkflow, [
      expect.objectContaining({
        lessonId: lesson.id,
        planGoalId: goal.id,
        planManifest: expect.objectContaining({
          basis: expect.objectContaining({ inputVersion: plan.inputVersion + 2 }),
        }),
      }),
    ]);

    expect(heldWhileWaiting).toStrictEqual([false]);
  });
});
