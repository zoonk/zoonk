import { randomUUID } from "node:crypto";
import { purgeEvaluationRuns } from "@zoonk/core/evaluation-runs/purge";
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
import { describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { getStartMock } from "../../_test-utils/start-mock";
import { freshnessWorkflow } from "../freshness/freshness-workflow";
import { laterReviewWorkflow } from "../quality/later-review-workflow";
import { flaggedContentWorkflow } from "../review-flags/flagged-content-workflow";
import { dailySweepsWorkflow } from "./daily-sweeps-workflow";
import type * as EvaluationRunsPurge from "@zoonk/core/evaluation-runs/purge";

vi.mock("workflow/api", () => ({ start: vi.fn(() => Promise.resolve({ runId: "started-run" })) }));

// A sweep failing can't be produced safely with the real database: one test makes the purge
// fail once, and every other run purges for real.
vi.mock("@zoonk/core/evaluation-runs/purge", async (importOriginal) => {
  const original = await importOriginal<typeof EvaluationRunsPurge>();
  return { purgeEvaluationRuns: vi.fn(original.purgeEvaluationRuns) };
});

const DAY_MS = 86_400_000;
/** Enough learners for real answers to replace a question's generated difficulty. */
const LEARNERS_TO_RECALIBRATE = 20;

/** A generated "medium" question that every learner answered wrong today. */
async function missedQuestionFixture() {
  const skill = await skillFixture();

  const [item, learners] = await Promise.all([
    itemFixture({ difficulty: 0, skillId: skill.id }),
    Promise.all(Array.from({ length: LEARNERS_TO_RECALIBRATE }, () => userFixture())),
  ]);

  await Promise.all(
    learners.map((learner) =>
      attemptFixture({ isCorrect: false, itemId: item.id, userId: learner.id }),
    ),
  );

  return item;
}

describe(dailySweepsWorkflow, () => {
  it("checks due exams and sources, deletes inactive guests, purges old memory and evaluation runs, recalibrates questions and starts the later check of lessons made ahead", async () => {
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

    const [fact, lesson, question, oldRun] = await Promise.all([
      memoryFactFixture({
        deletedAt: new Date(now - 40 * DAY_MS),
        status: "deleted",
        userId: learner.id,
      }),
      // Published today and in the one-in-five sample, which lesson ids land in by their last digits.
      libraryLessonFixture({
        contentStatus: "completed",
        id: `${randomUUID().slice(0, -8)}0000000a`,
      }),
      missedQuestionFixture(),
      evaluationRunFixture({ createdAt: new Date(now - 31 * DAY_MS) }),
    ]);

    const result = await dailySweepsWorkflow();

    expect(result.guestsDeleted).toBeGreaterThanOrEqual(1);
    expect(result.memoryFactsPurged).toBeGreaterThanOrEqual(1);
    expect(result.itemsRecalibrated).toBeGreaterThanOrEqual(1);
    expect(result.evaluationRunsPurged).toBeGreaterThanOrEqual(1);

    await Promise.all([
      expect(prisma.user.findUnique({ where: { id: guest.id } })).resolves.toBeNull(),
      expect(prisma.memoryFact.findUnique({ where: { id: fact.id } })).resolves.toBeNull(),
      expect(prisma.evaluationRun.findUnique({ where: { id: oldRun.id } })).resolves.toBeNull(),
    ]);

    const recalibrated = await prisma.item.findUniqueOrThrow({ where: { id: question.id } });
    expect(recalibrated.difficulty).toBeGreaterThan(1);

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
    // Due just before tomorrow's sweep, so other tests' due exams can't push it out of its batch.
    const exam = await examBlueprintFixture({
      nextCheckAt: new Date(Date.now() + DAY_MS - 60_000),
    });

    vi.mocked(purgeEvaluationRuns).mockRejectedValueOnce(new Error("Database timeout"));

    const result = await dailySweepsWorkflow();

    expect(result.evaluationRunsPurged).toBe(0);

    expect(start).toHaveBeenCalledWith(freshnessWorkflow, [
      { examBlueprintId: exam.id, kind: "exam" },
    ]);

    expect(result.freshnessChecks).toBeGreaterThanOrEqual(1);
  });
});
