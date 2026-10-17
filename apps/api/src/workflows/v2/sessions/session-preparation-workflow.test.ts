import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { buildPlan } from "../../../../../../packages/core/src/plans/planner/build-plan";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { sessionPreparationWorkflow } from "./session-preparation-workflow";

vi.mock("../../../../../../packages/core/src/plans/planner/build-plan", { spy: true });

const TODAY = new Date("2026-09-30T00:00:00Z");

describe("session preparation records admission for its children", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
  });

  afterEach(() => vi.useRealTimers());

  it("publishes one parent manifest for the selected children without a planner entry", async () => {
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

    const item = await planItemFixture({
      lessonId: lesson.id,
      planId: plan.id,
      scheduledFor: TODAY,
    });

    await studySessionBlockFixture({ lessonId: lesson.id, sessionId: session.id });
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
});
