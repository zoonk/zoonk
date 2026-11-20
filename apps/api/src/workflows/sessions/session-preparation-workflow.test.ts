import { prisma } from "@zoonk/db";
import { markPlanInputsChanged } from "@zoonk/db/learner-writes";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHook, sleep } from "workflow";
import { getRun, start } from "workflow/api";
import * as plannerLessons from "../../../../../packages/core/src/plans/_utils/planner-lessons";
import { buildPlan } from "../../../../../packages/core/src/plans/planner/build-plan";
import { courseOutlineWorkflow } from "../courses/course-outline-workflow";
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

  it("personalizes today's written lessons without waiting for next-day background writing", async () => {
    const { goal, lesson, plan, user } = await sessionWithLesson();
    const tomorrow = await libraryLessonFixture();

    await Promise.all([
      prisma.lesson.update({ data: { contentStatus: "completed" }, where: { id: lesson.id } }),
      prisma.goal.update({
        data: { details: { placementDeclined: true, purpose: "work", role: "ICU nurse" } },
        where: { id: goal.id },
      }),
      planItemFixture({
        lessonId: tomorrow.id,
        planId: plan.id,
        position: 1,
        scheduledFor: new Date("2026-10-01T00:00:00Z"),
      }),
    ]);

    await expect(
      sessionPreparationWorkflow({ goalId: goal.id, lessonsAskedAt: null, userId: user.id }),
    ).resolves.toMatchObject({ laterLessonIds: [tomorrow.id], lessonIds: [], status: "prepared" });

    expect(sleep).not.toHaveBeenCalled();
  });

  it.each([
    { guest: false, lands: true },
    { guest: false, lands: false },
    { guest: true, lands: true },
  ])(
    "prepares the selected lesson after outlining (guest: $guest, lands: $lands)",
    async ({ guest, lands }) => {
      const { goal, item, lesson, plan, user } = await sessionWithLesson();

      const [course, skill, first, second, later] = await Promise.all([
        courseFixture(),
        skillFixture(),
        libraryLessonFixture(),
        libraryLessonFixture(),
        libraryLessonFixture(),
      ]);

      const tomorrow = new Date("2026-10-01T00:00:00Z");
      const scheduledFor = guest ? null : tomorrow;

      const [placeholder] = await Promise.all([
        planItemFixture({ planId: plan.id, position: 1, scheduledFor, skillId: skill.id }),
        planItemFixture({
          lessonId: later.id,
          planId: plan.id,
          position: 3,
          scheduledFor: new Date("2026-10-02T00:00:00Z"),
        }),
        prisma.plan.update({
          data: {
            graph: {
              phases: [{ milestone: null, name: "Phase" }],
              skills: [
                {
                  area: null,
                  courseIds: [course.id],
                  lessons: 2,
                  name: skill.name,
                  phase: 0,
                  skillId: skill.id,
                  weight: null,
                },
              ],
            },
          },
          where: { id: plan.id },
        }),
        guest ? prisma.planItem.delete({ where: { id: item.id } }) : null,
        guest ? prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } }) : null,
      ]);

      vi.mocked(start).mockImplementation((workflow: unknown) =>
        Promise.resolve({
          runId: workflow === courseOutlineWorkflow ? "outline" : "lesson",
        } as Awaited<ReturnType<typeof start>>),
      );

      vi.mocked(getRun).mockImplementation((runId) => {
        if (runId === "outline") {
          return {
            exists: Promise.resolve(true),
            get returnValue() {
              // The workflow runtime is mocked; persist the outline's plan landing before it returns.
              return landOutline();
            },
            status: Promise.resolve("completed"),
          } as ReturnType<typeof getRun>;
        }

        return { exists: Promise.resolve(false) } as ReturnType<typeof getRun>;
      });

      async function landOutline() {
        if (lands) {
          await Promise.all([
            prisma.planItem.update({ data: { lessonId: first.id }, where: { id: placeholder.id } }),
            planItemFixture({
              lessonId: second.id,
              planId: plan.id,
              position: 2,
              scheduledFor,
              skillId: skill.id,
            }),
          ]);
        } else {
          await prisma.planItem.delete({ where: { id: placeholder.id } });
        }

        return { bandsWritten: 1, chapterIds: [], status: "written" };
      }

      await expect(
        sessionPreparationWorkflow({ goalId: goal.id, lessonsAskedAt: null, userId: user.id }),
      ).resolves.toMatchObject(
        guest
          ? { status: "guest" }
          : { laterLessonIds: lands ? [first.id] : [], status: "prepared" },
      );

      expect(start).toHaveBeenCalledWith(courseOutlineWorkflow, [
        expect.objectContaining({ courseId: course.id, forGuest: guest }),
      ]);

      const calls: readonly unknown[][] = vi.mocked(start).mock.calls;
      const children = calls.filter(([workflow]) => workflow === lessonContentWorkflow);
      const immediate = { lessonId: lesson.id };
      const afterOutline = { lessonId: first.id, wait: guest ? "learner" : "later" };
      const expected = [...(guest ? [] : [[immediate]]), ...(lands ? [[afterOutline]] : [])];
      expect(children.map(([, args]) => args)).toMatchObject(expected);

      await expect(
        prisma.usageRecord.findMany({
          select: { targetId: true },
          where: { kind: "lessonStart", userId: user.id },
        }),
      ).resolves.toStrictEqual(guest ? [{ targetId: first.id }] : []);
    },
  );

  it.each([
    { readyToday: true, used: 2, writes: "tomorrow" },
    { readyToday: false, used: 1, writes: "today" },
    { readyToday: true, used: 3, writes: "neither day" },
  ] as const)(
    "writes $writes for a guest with $used starts used",
    async ({ readyToday, used, writes }) => {
      const { goal, lesson, plan, user } = await sessionWithLesson();

      const [tomorrow] = await Promise.all([
        libraryLessonFixture(),
        prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } }),
        usageRecordsFixture({ count: used, userId: user.id }),
        readyToday
          ? prisma.lesson.update({ data: { contentStatus: "completed" }, where: { id: lesson.id } })
          : null,
      ]);

      await planItemFixture({
        lessonId: tomorrow.id,
        planId: plan.id,
        position: 1,
        scheduledFor: new Date("2026-10-01T00:00:00Z"),
      });

      await expect(
        sessionPreparationWorkflow({ goalId: goal.id, lessonsAskedAt: null, userId: user.id }),
      ).resolves.toStrictEqual({ status: "guest" });

      const expected = {
        "neither day": [],
        today: [[{ lessonId: lesson.id, wait: "learner" }]],
        tomorrow: [[{ lessonId: tomorrow.id, wait: "later" }]],
      };

      const calls: readonly unknown[][] = vi.mocked(start).mock.calls;
      const started = calls.filter(([workflow]) => workflow === lessonContentWorkflow);
      expect(started.map(([, args]) => args)).toMatchObject(expected[writes]);

      await expect(
        prisma.usageRecord.count({ where: { kind: "lessonStart", userId: user.id } }),
      ).resolves.toBe(used + expected[writes].length);
    },
  );

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
