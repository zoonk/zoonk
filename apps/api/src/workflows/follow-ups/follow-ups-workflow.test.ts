import { randomUUID } from "node:crypto";
import { PlanConflictError } from "@zoonk/core/plans/conflict";
import { refreshOwedStudyDay } from "@zoonk/core/sessions/refresh-owed-day";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { sleep } from "workflow";
import { HookConflictError } from "workflow/errors";
import { getStartMock } from "../_test-utils/start-mock";
import { placementItemsWorkflow } from "../goals/placement-items-workflow";
import { rebuildGoalCurriculumWorkflow } from "../goals/rebuild-goal-curriculum-workflow";
import { chapterMindMapWorkflow } from "../mind-maps/chapter-mind-map-workflow";
import { followUpsWorkflow } from "./follow-ups-workflow";

// Force a competing plan write after core's quick retry without timing real database writers.
vi.mock("@zoonk/core/sessions/refresh-owed-day", () => ({ refreshOwedStudyDay: vi.fn() }));

const CAUSE = {
  correctAnswer: "since",
  language: "en",
  learnerAnswer: "for",
  misconception: "",
  question: "I've lived here ___ 2020.",
  recentAccuracy: "3 of 5 right",
};

/** A learner who finished a chapter whose lessons are written, with its map owed. */
async function owedMindMap() {
  const user = await userFixture();

  const [chapter, lesson, goal] = await Promise.all([
    libraryChapterFixture({ title: "Cells" }),
    libraryLessonFixture({ contentStatus: "completed" }),
    goalFixture({ userId: user.id }),
  ]);

  const plan = await planFixture({ goalId: goal.id });

  await Promise.all([
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
    planItemFixture({
      chapterId: chapter.id,
      lessonId: lesson.id,
      planId: plan.id,
      position: 0,
      status: "done",
    }),
    prisma.followUp.create({
      data: {
        input: { chapterId: chapter.id, goalId: goal.id },
        key: chapter.id,
        kind: "makeChapterMindMap",
        userId: user.id,
      },
    }),
  ]);

  return { chapter, goal, user };
}

describe(followUpsWorkflow, () => {
  it("makes an owed map through the learner's own admission, as a tap would", async () => {
    const { chapter, goal, user } = await owedMindMap();

    await followUpsWorkflow({ userId: user.id });

    expect(getStartMock()).toHaveBeenCalledWith(
      chapterMindMapWorkflow,
      [
        {
          analytics: { distinctId: user.id, goalId: goal.id, platform: null },
          chapterId: chapter.id,
          lessons: { forExam: false, ids: [] },
        },
      ],
      { experimental_hook: { token: `mind-map:${chapter.id}` } },
    );

    await expect(
      prisma.chapterMindMap.findUniqueOrThrow({ where: { chapterId: chapter.id } }),
    ).resolves.toMatchObject({ status: "running" });

    await expect(
      prisma.usageRecord.findMany({
        select: { kind: true, targetId: true },
        where: { userId: user.id },
      }),
    ).resolves.toStrictEqual([{ kind: "mindMap", targetId: chapter.id }]);

    await expect(prisma.followUp.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("ends an owed map the learner's limits refuse, without starting it", async () => {
    const { chapter, user } = await owedMindMap();

    await prisma.usageRecord.createMany({
      data: Array.from({ length: 3 }, () => ({
        generated: true,
        kind: "mindMap" as const,
        targetId: randomUUID(),
        userId: user.id,
      })),
    });

    await followUpsWorkflow({ userId: user.id });

    expect(getStartMock()).not.toHaveBeenCalledWith(chapterMindMapWorkflow, expect.anything());

    await expect(prisma.chapterMindMap.count({ where: { chapterId: chapter.id } })).resolves.toBe(
      0,
    );

    await expect(prisma.followUp.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("starts one rebuild for a coalesced answer revision", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    const owed = await prisma.followUp.create({
      data: {
        input: { goalId: goal.id },
        key: goal.id,
        kind: "rebuildGoalCurriculum",
        revision: 2,
        userId: user.id,
      },
    });

    await followUpsWorkflow({ userId: user.id });

    expect(getStartMock()).toHaveBeenCalledExactlyOnceWith(
      rebuildGoalCurriculumWorkflow,
      [{ followUp: { id: owed.id, revision: owed.revision }, goalId: goal.id }],
      { experimental_hook: { token: `goal-rebuild:${goal.id}:${owed.id}:2` } },
    );

    await expect(prisma.followUp.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it("starts fresh placement preparation for an answer saved after an earlier run began", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    const owed = await prisma.followUp.create({
      data: {
        input: { goalId: goal.id, waitsForNotice: false },
        key: goal.id,
        kind: "preparePlacementItems",
        revision: 2,
        userId: user.id,
      },
    });

    await followUpsWorkflow({ userId: user.id });

    expect(getStartMock()).toHaveBeenCalledExactlyOnceWith(
      placementItemsWorkflow,
      [{ analytics: { distinctId: user.id }, goalId: goal.id, waitsForNotice: false }],
      { experimental_hook: { token: `placement-items:${goal.id}:${owed.id}:2` } },
    );

    await expect(prisma.followUp.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("waits out a refresh plan conflict and completes the pass's other owed work", async () => {
    const user = await userFixture();
    const mistake = await mistakeFixture({ cause: null, userId: user.id });
    const sessionId = crypto.randomUUID();

    await prisma.followUp.createMany({
      data: [
        {
          input: { sessionId, timeZone: "UTC" },
          key: sessionId,
          kind: "refreshStudyDay",
          userId: user.id,
        },
        {
          input: { cause: CAUSE, mistakeId: mistake.id },
          key: mistake.id,
          kind: "classifyMistakeCause",
          userId: user.id,
        },
      ],
    });

    vi.mocked(refreshOwedStudyDay)
      .mockRejectedValueOnce(new PlanConflictError())
      .mockResolvedValueOnce();

    await expect(followUpsWorkflow({ userId: user.id })).resolves.toBeUndefined();
    expect(refreshOwedStudyDay).toHaveBeenCalledTimes(2);

    expect(refreshOwedStudyDay).toHaveBeenLastCalledWith({
      sessionId,
      timeZone: "UTC",
      userId: user.id,
    });

    expect(sleep).toHaveBeenCalledExactlyOnceWith("5s");
    expect(getStartMock()).toHaveBeenCalledOnce();
    await expect(prisma.followUp.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("keeps a row whose start named a run that was never created", async () => {
    const user = await userFixture();
    const mistake = await mistakeFixture({ cause: null, userId: user.id });

    await prisma.followUp.create({
      data: {
        input: { cause: CAUSE, mistakeId: mistake.id },
        key: mistake.id,
        kind: "classifyMistakeCause",
        userId: user.id,
      },
    });

    getStartMock().mockRejectedValue(new HookConflictError("background-task", "admitted"));

    const failure = await followUpsWorkflow({ userId: user.id }).catch((error: unknown) => error);

    await expect(prisma.followUp.count({ where: { userId: user.id } })).resolves.toBe(1);
    expect(failure).toBeInstanceOf(Error);
  });
});
