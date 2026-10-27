import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { describe, expect, it, vi } from "vitest";
import * as skillUpdates from "../../learner/_utils/update-learner-skill";
import { BRAIN_POWER_BONUS } from "../../sessions/brain-power";
import { setupPlayableLesson } from "../_test-utils/playable-lesson-setup";
import { checkLessonStep } from "../check-lesson-step";
import { completeLibraryLesson } from "../complete-library-lesson";
import { startLibraryLesson } from "../start-library-lesson";

const TIME_ZONE = "UTC";

/** Two plan skills the lesson's finer-grained answer does not directly train. */
async function owedReviewsFixture() {
  const setup = await setupPlayableLesson({ steps: ["check"] });

  const [goal, first, second] = await Promise.all([
    goalFixture({ timezone: TIME_ZONE, userId: setup.user.id }),
    skillFixture(),
    skillFixture(),
  ]);

  const plan = await planFixture({ goalId: goal.id });
  const skillIds = [first.id, second.id];

  await Promise.all(
    skillIds.map((skillId, position) =>
      planItemFixture({
        kind: "lesson",
        lessonId: setup.lesson.id,
        planId: plan.id,
        position,
        skillId,
      }),
    ),
  );

  const started = await startLibraryLesson({
    input: { timeZone: TIME_ZONE },
    lessonId: setup.lesson.id,
  });

  if (started.status !== "started") {
    throw new Error("Expected an open lesson run");
  }

  const runId = started.run.runId;
  const step = setup.steps[0];

  if (!step) {
    throw new Error("Expected the lesson's choice question");
  }

  await checkLessonStep({
    input: {
      answer: { kind: "check", optionId: "likely" },
      durationMs: 5000,
      runId,
      timeZone: TIME_ZONE,
    },
    stepId: step.id,
  });

  return { ...setup, runId, skillIds };
}

function finish({ lesson, runId }: Awaited<ReturnType<typeof owedReviewsFixture>>) {
  return completeLibraryLesson({ input: { runId, timeZone: TIME_ZONE }, lessonId: lesson.id });
}

async function readMemories({ skillIds, user }: Awaited<ReturnType<typeof owedReviewsFixture>>) {
  return prisma.learnerSkill.findMany({
    orderBy: { skillId: "asc" },
    where: { skillId: { in: skillIds }, userId: user.id },
  });
}

describe("atomic plan-skill reviews on lesson completion", () => {
  it("retries every owed review exactly once after failure on the second skill", async () => {
    const setup = await owedReviewsFixture();
    const update = skillUpdates.applyAnswerToLearnerSkill;
    const firstApplied = Promise.withResolvers<null>();
    const calls = { count: 0 };

    // Inject only the interruption: the first skill still executes its real database update.
    const fault = vi
      .spyOn(skillUpdates, "applyAnswerToLearnerSkill")
      .mockImplementation(async (...args) => {
        calls.count += 1;

        if (calls.count === 2) {
          await firstApplied.promise;
          throw new Error("Interrupted after the first plan-skill review");
        }

        const reviewed = await update(...args);
        firstApplied.resolve(null);
        return reviewed;
      });

    try {
      await expect(finish(setup)).rejects.toThrow("Interrupted after the first plan-skill review");
    } finally {
      fault.mockRestore();
    }

    const interrupted = await prisma.learningEvent.findUniqueOrThrow({
      where: { id: setup.runId },
    });

    const interruptedMemories = await readMemories(setup);
    await expect(finish(setup)).resolves.toMatchObject({ status: "completed" });
    await expect(finish(setup)).resolves.toMatchObject({ status: "completed" });

    const memories = await readMemories(setup);
    expect(memories.map((memory) => memory.reps)).toStrictEqual([1, 1]);
    expect(calls.count).toBe(2);
    expect(interrupted.endedAt).toBeNull();
    expect(interruptedMemories).toHaveLength(0);

    const [run, progress, day] = await Promise.all([
      prisma.learningEvent.findUniqueOrThrow({ where: { id: setup.runId } }),
      prisma.userProgress.findUniqueOrThrow({ where: { userId: setup.user.id } }),
      prisma.dailyProgress.findFirstOrThrow({ where: { userId: setup.user.id } }),
    ]);

    expect(run.endedAt).not.toBeNull();
    // The lesson finished today's only block, saved when it started: the day's bonus pays once too.
    expect(Number(progress.totalBrainPower)).toBe(run.brainPower + BRAIN_POWER_BONUS.fullMeal);
    expect(day.lessonsCompleted).toBe(1);
  });

  it("reviews both skills once when two completions race on the same run", async () => {
    const setup = await owedReviewsFixture();
    const outcomes = await Promise.all([finish(setup), finish(setup)]);
    expect(outcomes.map((outcome) => outcome.status)).toStrictEqual(["completed", "completed"]);
    const memories = await readMemories(setup);
    expect(memories.map((memory) => memory.reps)).toStrictEqual([1, 1]);
  });
});
