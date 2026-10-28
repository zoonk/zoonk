import { isPlanConflictError } from "@zoonk/core/plans/conflict";
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
import { buildPlan } from "../../../../../../packages/core/src/plans/planner/build-plan";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { sessionPreparationWorkflow } from "./session-preparation-workflow";
import * as preparationSteps from "./steps/session-preparation-steps";

vi.mock("../../../../../../packages/core/src/plans/planner/build-plan", { spy: true });

const TODAY = new Date("2026-09-30T00:00:00Z");
/** How many times the durable runtime retries a step that throws (`maxRetries`' default). */
const STEP_RETRIES = 3;

/** A learner whose session today has one unwritten lesson their plan schedules. */
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

  afterEach(() => vi.useRealTimers());

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

    // Minutes after the goal was made, its later bands aren't outlined: the plan still stands in
    // for their skills, which the read resolves against what the Library outlined so far.
    const skill = await skillFixture();
    await planItemFixture({ planId: plan.id, skillId: skill.id });

    // Other runs (the goal's outline bands, its lesson saves) mark the plan while the session's
    // targets are read, between every read's token and its check, until the run waits. A few
    // write at once, so a mark lands within each read.
    const createManifest = preparationSteps.createSessionGenerationManifestStep;
    const burst = { over: false, started: false };
    let marks: Promise<unknown> = Promise.resolve();

    const markUntilTheRunWaits = async () => {
      while (!burst.over) {
        // oxlint-disable-next-line no-await-in-loop -- each write marks the plan in turn
        await prisma.$transaction((tx) => markPlanInputsChanged(tx, { userIds: [user.id] }));
      }
    };

    // The durable runtime runs a step that threw again at once, up to its retries; this inline
    // run does the same, so the burst outlasts every retry that doesn't wait.
    const createAsTheRuntimeDoes = async (
      input: Parameters<typeof createManifest>[0],
      attempt = 0,
    ): ReturnType<typeof createManifest> => {
      try {
        return await createManifest(input);
      } catch (error) {
        if (!isPlanConflictError(error) || attempt >= STEP_RETRIES) {
          throw error;
        }

        return createAsTheRuntimeDoes(input, attempt + 1);
      }
    };

    const manifest = vi
      .spyOn(preparationSteps, "createSessionGenerationManifestStep")
      .mockImplementation((input) => {
        if (!burst.started) {
          burst.started = true;
          marks = Promise.all(Array.from({ length: 3 }, () => markUntilTheRunWaits()));
        }

        return createAsTheRuntimeDoes(input);
      });

    // The tokens held now: a hook holds its token until it's disposed. Whether the learner's
    // preparation token was held when the run waited says whether a session the learner starts
    // meanwhile prepares, instead of being left to this run.
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
      if (!burst.started) {
        return;
      }

      heldWhileWaiting.push(held.has(`session-prep:${user.id}`));
      burst.over = true;
      await marks;
    });

    try {
      await expect(
        sessionPreparationWorkflow({ goalId: goal.id, timeZone: "UTC", userId: user.id }),
      ).resolves.toMatchObject({ lessonIds: [lesson.id], status: "prepared" });

      expect(start).toHaveBeenCalledWith(lessonContentWorkflow, [
        expect.objectContaining({ lessonId: lesson.id, planGoalId: goal.id }),
      ]);

      expect(heldWhileWaiting).toStrictEqual([false]);
    } finally {
      burst.over = true;
      await marks;
      manifest.mockRestore();
    }
  });
});
