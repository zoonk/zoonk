import { randomUUID } from "node:crypto";
import { recordSourceChangeNotice } from "@zoonk/core/library/sources/notices";
import { prisma } from "@zoonk/db";
import { evaluationRunFixture } from "@zoonk/testing/fixtures/evaluation-runs";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { start } from "workflow/api";
import { getStartMock } from "../../_test-utils/start-mock";
import { freshnessWorkflow } from "../freshness/freshness-workflow";
import { laterReviewWorkflow } from "../quality/later-review-workflow";
import { flaggedContentWorkflow } from "../review-flags/flagged-content-workflow";
import { dailySweepsWorkflow } from "./daily-sweeps-workflow";

const DAY_MS = 86_400_000;
const LEARNERS_TO_RECALIBRATE = 20;

function verificationFixture(expiresAt: Date) {
  return prisma.verification.create({
    data: { expiresAt, identifier: `sign-in-otp-${randomUUID()}@zoonk.test`, value: "123456:0" },
  });
}

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
  it("checks due exams and sources, deletes inactive guests, purges old memory and evaluation runs, recalibrates questions, starts the later check of lessons made ahead, deletes lesson versions replaced days ago and sign-in codes expired days ago", async () => {
    const now = Date.now();

    const [guest, learner, exam] = await Promise.all([
      userFixture(),
      userFixture(),
      // The sweep takes the latest due first, so other tests' due exams can't push this one out of
      // its batch.
      examBlueprintFixture({ nextCheckAt: new Date(now + DAY_MS - 60_000) }),
    ]);

    await prisma.user.update({
      data: { createdAt: new Date(now - 60 * DAY_MS), isAnonymous: true },
      where: { id: guest.id },
    });

    const [lesson, oldCode, expiredCode] = await Promise.all([
      // Ids ending this way land in the later review's one-in-five sample.
      libraryLessonFixture({
        contentStatus: "completed",
        id: `${randomUUID().slice(0, -8)}0000000a`,
      }),
      verificationFixture(new Date(now - 2 * DAY_MS)),
      verificationFixture(new Date(now - 60_000)),
      memoryFactFixture({
        deletedAt: new Date(now - 40 * DAY_MS),
        status: "deleted",
        userId: learner.id,
      }),
      missedQuestionFixture(),
      evaluationRunFixture({ createdAt: new Date(now - 31 * DAY_MS) }),
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

    expect(start).toHaveBeenCalledWith(flaggedContentWorkflow, [{}]);
  });

  it("counts a sweep that failed as nothing and still runs the others", async () => {
    const [exam] = await Promise.all([
      // The sweep takes the latest due first, so other tests' due exams can't push this one out of
      // its batch.
      examBlueprintFixture({ nextCheckAt: new Date(Date.now() + DAY_MS - 60_000) }),
      evaluationRunFixture({ createdAt: new Date(Date.now() - 31 * DAY_MS) }),
    ]);

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
