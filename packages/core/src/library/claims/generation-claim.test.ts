import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { revalidateTag } from "next/cache";
import { describe, expect, it } from "vitest";
import { holdPlanLock, waitForBlockedStatement } from "../../_test-utils/learner-lock";
import { getLibraryLessonCacheTag } from "../../cache/tags";
import { placeChapterLessons } from "../lessons/place-chapter-lessons";
import { claimLibraryGeneration, finishLibraryGeneration } from "./generation-claim";

describe(claimLibraryGeneration, () => {
  it("lets exactly one of two racing workflows claim a lesson's content", async () => {
    const lesson = await libraryLessonFixture();
    const [firstRun, secondRun] = [randomUUID(), randomUUID()];

    const results = await Promise.all([
      claimLibraryGeneration({ id: lesson.id, target: "lessonContent", workflowRunId: firstRun }),
      claimLibraryGeneration({ id: lesson.id, target: "lessonContent", workflowRunId: secondRun }),
    ]);

    expect(results.toSorted()).toStrictEqual(["claimed", "running"]);

    const stored = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    const winner = results[0] === "claimed" ? firstRun : secondRun;

    expect(stored).toMatchObject({ contentRunId: winner, contentStatus: "running" });
    expect(revalidateTag).toHaveBeenCalledWith(getLibraryLessonCacheTag(lesson.id), { expire: 0 });
  });

  it("keeps a claim for the run that holds it when its step retries", async () => {
    const chapter = await libraryChapterFixture();
    const workflowRunId = randomUUID();
    const claim = { id: chapter.id, target: "chapterOutline" as const, workflowRunId };

    await expect(claimLibraryGeneration(claim)).resolves.toBe("claimed");
    await expect(claimLibraryGeneration(claim)).resolves.toBe("claimed");
  });

  it("reports completed work instead of claiming it again", async () => {
    const lesson = await libraryLessonFixture({ specStatus: "completed" });

    await expect(
      claimLibraryGeneration({ id: lesson.id, target: "lessonSpec", workflowRunId: randomUUID() }),
    ).resolves.toBe("completed");
  });

  it("retires a pulled lesson's screens when a new run claims its content, keeping them for learners playing them", async () => {
    const lesson = await libraryLessonFixture({ contentStatus: "failed" });
    const step = await libraryStepFixture({ lessonId: lesson.id, position: 0 });

    await expect(
      claimLibraryGeneration({
        id: lesson.id,
        target: "lessonContent",
        workflowRunId: randomUUID(),
      }),
    ).resolves.toBe("claimed");

    await expect(prisma.step.findUniqueOrThrow({ where: { id: step.id } })).resolves.toMatchObject({
      retiredAt: expect.any(Date),
    });
  });

  it("takes a pulled lesson's questions out of the bank when a new run claims its content", async () => {
    const [lesson, skill] = await Promise.all([
      libraryLessonFixture({ contentStatus: "failed" }),
      skillFixture(),
    ]);

    const [asked, bank] = await Promise.all([
      itemFixture({ skillId: skill.id }),
      itemFixture({ skillId: skill.id }),
    ]);

    await libraryStepFixture({ itemId: asked.id, kind: "check", lessonId: lesson.id });

    await claimLibraryGeneration({
      id: lesson.id,
      target: "lessonContent",
      workflowRunId: randomUUID(),
    });

    await expect(
      prisma.item.findMany({ select: { id: true }, where: { retiredAt: null, skillId: skill.id } }),
    ).resolves.toStrictEqual([{ id: bank.id }]);
  });

  it("claims a pulled lesson while its chapter places it, both waiting on the same plan", async () => {
    const [lesson, skill, chapter, user] = await Promise.all([
      libraryLessonFixture({ contentStatus: "failed" }),
      skillFixture(),
      libraryChapterFixture(),
      userFixture(),
    ]);

    const question = await itemFixture({ skillId: skill.id });
    const goal = await goalFixture({ userId: user.id });

    const [plan] = await Promise.all([
      planFixture({ goalId: goal.id, sourceSkillIds: [skill.id] }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
      libraryStepFixture({ itemId: question.id, kind: "check", lessonId: lesson.id }),
    ]);

    const lock = holdPlanLock({ planId: plan.id });
    const pid = await lock.pid;
    const placing = placeChapterLessons({ chapterId: chapter.id, lessonIds: [lesson.id] });
    const claim = { id: lesson.id, target: "lessonContent" as const, workflowRunId: randomUUID() };

    const claiming = waitForBlockedStatement(pid, /FOR UPDATE OF plan/u).then(() =>
      claimLibraryGeneration(claim),
    );

    try {
      await waitForBlockedStatement(pid, /FOR UPDATE OF plan/u, 2);
    } finally {
      lock.release();
      await lock.done;
    }

    const settled = await Promise.allSettled([placing, claiming]);
    expect(settled.map((outcome) => outcome.status)).toStrictEqual(["fulfilled", "fulfilled"]);
  });

  it("claims the outline of a course made before outlines existed", async () => {
    const course = await courseFixture({ outlineStatus: null });

    await expect(
      claimLibraryGeneration({
        id: course.id,
        target: "courseOutline",
        workflowRunId: randomUUID(),
      }),
    ).resolves.toBe("claimed");
  });

  it("fails loudly for a row that doesn't exist", async () => {
    await expect(
      claimLibraryGeneration({ id: randomUUID(), target: "lessonContent", workflowRunId: "run" }),
    ).rejects.toThrow("missing row");
  });
});

describe(finishLibraryGeneration, () => {
  it("only lets the run holding the claim finish it", async () => {
    const lesson = await libraryLessonFixture();
    const workflowRunId = randomUUID();

    await claimLibraryGeneration({ id: lesson.id, target: "lessonContent", workflowRunId });

    await expect(
      finishLibraryGeneration({
        id: lesson.id,
        status: "completed",
        target: "lessonContent",
        workflowRunId: randomUUID(),
      }),
    ).resolves.toBe(false);

    await expect(
      finishLibraryGeneration({
        id: lesson.id,
        status: "completed",
        target: "lessonContent",
        workflowRunId,
      }),
    ).resolves.toBe(true);

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ).resolves.toMatchObject({ contentRunId: workflowRunId, contentStatus: "completed" });
  });

  it("lets another run claim work that failed", async () => {
    const chapter = await libraryChapterFixture();
    const failedRun = randomUUID();

    await claimLibraryGeneration({
      id: chapter.id,
      target: "chapterOutline",
      workflowRunId: failedRun,
    });

    await finishLibraryGeneration({
      id: chapter.id,
      status: "failed",
      target: "chapterOutline",
      workflowRunId: failedRun,
    });

    await expect(
      claimLibraryGeneration({
        id: chapter.id,
        target: "chapterOutline",
        workflowRunId: randomUUID(),
      }),
    ).resolves.toBe("claimed");
  });
});
