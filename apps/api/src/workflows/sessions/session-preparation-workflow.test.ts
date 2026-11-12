import { prisma } from "@zoonk/db";
import { markPlanInputsChanged } from "@zoonk/db/learner-writes";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
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
import * as personalVersions from "./steps/personal-versions-steps";

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

  it("starts the chapter challenge early at the soon tier under the same manifest", async () => {
    const { goal, lesson, plan, user } = await sessionWithLesson();
    const chapter = await libraryChapterFixture();
    await prisma.lesson.update({ data: { homeChapterId: chapter.id }, where: { id: lesson.id } });

    const challenge = await libraryLessonFixture({
      homeChapterId: chapter.id,
      identityKey: `challenge:${chapter.id}`,
    });

    await planItemFixture({
      lessonId: challenge.id,
      planId: plan.id,
      position: 10,
      scheduledFor: null,
    });

    await sessionPreparationWorkflow({ goalId: goal.id, lessonsAskedAt: null, userId: user.id });

    expect(start).toHaveBeenCalledWith(lessonContentWorkflow, [
      expect.objectContaining({
        lessonId: challenge.id,
        planManifest: expect.objectContaining({
          targets: [
            expect.objectContaining({ lessonId: lesson.id }),
            expect.objectContaining({ lessonId: challenge.id }),
          ],
        }),
        wait: "soon",
      }),
    ]);
  });

  it("does not start or poll a private challenge placement has not admitted", async () => {
    const { goal, lesson, plan, user } = await sessionWithLesson();
    const chapter = await libraryChapterFixture();

    await Promise.all([
      prisma.lesson.update({
        data: { contentStatus: "completed", homeChapterId: chapter.id },
        where: { id: lesson.id },
      }),
      prisma.goal.update({
        data: { details: { purpose: "work", role: "ICU nurse" } },
        where: { id: goal.id },
      }),
    ]);

    const challenge = await libraryLessonFixture({
      homeChapterId: chapter.id,
      identityKey: `challenge:${chapter.id}`,
      ownerId: user.id,
      visibility: "private",
    });

    await planItemFixture({
      lessonId: challenge.id,
      planId: plan.id,
      position: 10,
      scheduledFor: null,
    });

    await expect(
      sessionPreparationWorkflow({ goalId: goal.id, lessonsAskedAt: null, userId: user.id }),
    ).resolves.toMatchObject({ lessonIds: [] });

    expect(start).not.toHaveBeenCalledWith(lessonContentWorkflow, expect.anything());
    expect(sleep).not.toHaveBeenCalled();
  });

  it("waits for a chapter challenge already running before selecting its personal layer", async () => {
    const { goal, lesson, plan, user } = await sessionWithLesson();
    const chapter = await libraryChapterFixture();

    await Promise.all([
      prisma.lesson.update({
        data: { contentStatus: "completed", homeChapterId: chapter.id },
        where: { id: lesson.id },
      }),
      prisma.goal.update({
        data: { details: { placementDeclined: true, purpose: "work", role: "ICU nurse" } },
        where: { id: goal.id },
      }),
    ]);

    const challenge = await libraryLessonFixture({
      contentRunId: "shared-challenge-run",
      contentStatus: "running",
      homeChapterId: chapter.id,
      identityKey: `challenge:${chapter.id}`,
    });

    await planItemFixture({
      lessonId: challenge.id,
      planId: plan.id,
      position: 10,
      scheduledFor: null,
    });

    const targets = vi.spyOn(personalVersions, "listLearnerVersionTargetsStep");

    vi.mocked(sleep).mockImplementation(async () => {
      expect(targets).not.toHaveBeenCalled();

      await prisma.lesson.update({
        data: { contentStatus: "completed" },
        where: { id: challenge.id },
      });
    });

    await sessionPreparationWorkflow({ goalId: goal.id, lessonsAskedAt: null, userId: user.id });
    expect(sleep).toHaveBeenCalledWith("15s");
    expect(targets).toHaveBeenCalledWith({ goalId: goal.id, lessonIds: [lesson.id, challenge.id] });
    expect(start).not.toHaveBeenCalledWith(lessonContentWorkflow, expect.anything());
  });

  it("publishes one parent manifest for the selected children without a planner entry", async () => {
    const { goal, item, lesson, plan, user } = await sessionWithLesson();
    vi.mocked(buildPlan).mockClear();

    const result = await sessionPreparationWorkflow({
      goalId: goal.id,
      lessonsAskedAt: null,
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
      sessionPreparationWorkflow({ goalId: goal.id, lessonsAskedAt: null, userId: user.id }),
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
