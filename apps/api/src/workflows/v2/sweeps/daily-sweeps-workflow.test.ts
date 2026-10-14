import { randomUUID } from "node:crypto";
import { recordSourceChangeNotice } from "@zoonk/core/library/sources/notices";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { evaluationRunFixture } from "@zoonk/testing/fixtures/evaluation-runs";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { start } from "workflow/api";
import { getStartMock } from "../../_test-utils/start-mock";
import { courseDetailsWorkflow } from "../courses/course-details-workflow";
import { freshnessWorkflow } from "../freshness/freshness-workflow";
import { laterReviewWorkflow } from "../quality/later-review-workflow";
import { flaggedContentWorkflow } from "../review-flags/flagged-content-workflow";
import { dailySweepsWorkflow } from "./daily-sweeps-workflow";

const DAY_MS = 86_400_000;
/** Enough learners for real answers to replace a question's generated difficulty. */
const LEARNERS_TO_RECALIBRATE = 20;

/** A sign-in code that expired at `expiresAt`, as Better Auth stores it. */
function verificationFixture(expiresAt: Date) {
  return prisma.verification.create({
    data: { expiresAt, identifier: `sign-in-otp-${randomUUID()}@zoonk.test`, value: "123456:0" },
  });
}

/**
 * A generated "medium" question every learner answered wrong: one learner today, the rest learners
 * who since deleted their accounts, whose first answers count too.
 */
async function missedQuestionFixture() {
  const [skill, learner] = await Promise.all([skillFixture(), userFixture()]);
  const item = await itemFixture({ difficulty: 0, skillId: skill.id });

  await Promise.all([
    attemptFixture({ isCorrect: false, itemId: item.id, userId: learner.id }),
    prisma.anonymousFirstAnswer.createMany({
      data: Array.from({ length: LEARNERS_TO_RECALIBRATE - 1 }, () => ({
        isCorrect: false,
        itemId: item.id,
      })),
    }),
  ]);

  return item;
}

describe(dailySweepsWorkflow, () => {
  it("starts copy-only refreshes from the existing system sweep", async () => {
    const [course, chapter] = await Promise.all([
      courseFixture({
        detailsGeneratedAt: new Date(1),
        detailsPromptVersion: "old-sweep-copy",
        landingPage: { audience: [], outcomes: [], valueProposition: "Old copy" },
        visibility: "public",
      }),
      libraryChapterFixture(),
    ]);

    await courseChapterFixture({ chapterId: chapter.id, courseId: course.id });

    try {
      const result = await dailySweepsWorkflow();
      expect(result.courseCopyRewrites).toBeGreaterThan(0);

      expect(start).toHaveBeenCalledWith(
        courseDetailsWorkflow,
        [{ copyOnly: true, courseId: course.id }],
        { attributes: { courseId: course.id } },
      );
    } finally {
      await prisma.course.delete({ where: { id: course.id } });
    }
  });

  // What each sweep deletes, keeps or recalibrates is core's (each sweep's own test); this run
  // shows they all run and what each one counts.
  it("checks due exams and sources, deletes inactive guests, purges old memory and evaluation runs, recalibrates questions, starts the later check of lessons made ahead, deletes lesson versions replaced days ago and sign-in codes expired days ago", async () => {
    const now = Date.now();

    const [guest, learner, exam] = await Promise.all([
      userFixture(),
      userFixture(),
      // Due just before tomorrow's sweep: the sweep takes the latest due first, so other tests'
      // due exams in the shared database can't push this one out of its batch.
      examBlueprintFixture({ nextCheckAt: new Date(now + DAY_MS - 60_000) }),
    ]);

    await prisma.user.update({
      data: { createdAt: new Date(now - 60 * DAY_MS), isAnonymous: true },
      where: { id: guest.id },
    });

    const [lesson, oldCode, expiredCode] = await Promise.all([
      // Published today and in the one-in-five sample, which lesson ids land in by their last digits.
      libraryLessonFixture({
        contentStatus: "completed",
        id: `${randomUUID().slice(0, -8)}0000000a`,
      }),
      // A sign-in code that expired two days ago goes; one that just expired stays, so its
      // learner hears it expired.
      verificationFixture(new Date(now - 2 * DAY_MS)),
      verificationFixture(new Date(now - 60_000)),
      memoryFactFixture({
        deletedAt: new Date(now - 40 * DAY_MS),
        status: "deleted",
        userId: learner.id,
      }),
      missedQuestionFixture(),
      evaluationRunFixture({ createdAt: new Date(now - 31 * DAY_MS) }),
      // A screen a fixed version replaced two days ago: nobody plays it anymore.
      libraryLessonFixture({ contentStatus: "completed" }).then((replacedIn) =>
        libraryStepFixture({
          lessonId: replacedIn.id,
          position: 0,
          retiredAt: new Date(now - 2 * DAY_MS),
        }),
      ),
    ]);

    const result = await dailySweepsWorkflow();

    expect(result.guestsDeleted).toBeGreaterThanOrEqual(1);
    expect(result.memoryFactsPurged).toBeGreaterThanOrEqual(1);
    expect(result.itemsRecalibrated).toBeGreaterThanOrEqual(1);
    expect(result.evaluationRunsPurged).toBeGreaterThanOrEqual(1);
    expect(result.retiredStepsDeleted).toBeGreaterThanOrEqual(1);
    expect(result.verificationsPurged).toBeGreaterThanOrEqual(1);

    // Purging sign-in codes has no test of its own.
    await expect(
      Promise.all([
        prisma.verification.findUnique({ where: { id: oldCode.id } }),
        prisma.verification.findUnique({ where: { id: expiredCode.id } }),
      ]),
    ).resolves.toStrictEqual([null, expect.objectContaining({ id: expiredCode.id })]);

    expect(start).toHaveBeenCalledWith(freshnessWorkflow, [
      { examBlueprintId: exam.id, kind: "exam" },
    ]);

    expect(result.freshnessChecks).toBeGreaterThanOrEqual(1);

    // The shared test database holds other tests' lessons, so only this one's presence is checked.
    const reviewed = getStartMock()
      .mock.calls.filter(([workflow]) => workflow === laterReviewWorkflow)
      .flatMap(([, args]) => (args as [{ lessonIds: string[] }])[0].lessonIds);

    expect(reviewed).toContain(lesson.id);
    expect(result.laterReviews).toBe(reviewed.length);
  });

  it("starts the rewrite of what a changed source left flagged", async () => {
    const [law, lesson] = await Promise.all([
      sourceFixture({ language: "pt", title: "Lei nº 8.112, de 11 de dezembro de 1990" }),
      libraryLessonFixture({ contentStatus: "completed" }),
    ]);

    await libraryStepFixture({
      generatedAt: new Date(Date.now() - DAY_MS),
      lessonId: lesson.id,
      sourceId: law.id,
    });

    await recordSourceChangeNotice({
      contentHash: "new",
      fields: ["text"],
      language: "pt",
      message: "A lei mudou.",
      previousHash: "old",
      provenance: { generatedAt: new Date(), model: "test", promptVersion: "v1", runId: "r1" },
      sourceId: law.id,
    });

    await expect(dailySweepsWorkflow()).resolves.toMatchObject({ flaggedContentStarted: true });

    // Only what the sweep started: the rewrite itself reads the open flags when it runs.
    expect(start).toHaveBeenCalledWith(flaggedContentWorkflow, [{}]);
  });

  it("counts a sweep that failed as nothing and still runs the others", async () => {
    const [exam] = await Promise.all([
      // Due just before tomorrow's sweep, so other tests' due exams can't push it out of its batch.
      examBlueprintFixture({ nextCheckAt: new Date(Date.now() + DAY_MS - 60_000) }),
      evaluationRunFixture({ createdAt: new Date(Date.now() - 31 * DAY_MS) }),
    ]);

    // The queue is down for the freshness checks: that sweep fails.
    getStartMock().mockImplementation(async (workflow) => {
      if (workflow === freshnessWorkflow) {
        throw new Error("Queue unavailable");
      }

      return { runId: "started-run" } as Awaited<ReturnType<typeof start>>;
    });

    const result = await dailySweepsWorkflow();

    expect(start).toHaveBeenCalledWith(freshnessWorkflow, [
      { examBlueprintId: exam.id, kind: "exam" },
    ]);

    expect(result.freshnessChecks).toBe(0);
    expect(result.evaluationRunsPurged).toBeGreaterThanOrEqual(1);
  });
});
