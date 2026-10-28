import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { describe, expect, it } from "vitest";
import {
  setupPlayableLesson,
  stepOfKind,
} from "../lesson-player/_test-utils/playable-lesson-setup";
import { checkLessonStep } from "../lesson-player/check-lesson-step";
import { completeLibraryLesson } from "../lesson-player/complete-library-lesson";
import { startLibraryLesson } from "../lesson-player/start-library-lesson";
import { getTodayStudySession } from "./_test-utils/open-today";
import { startStudyBlock } from "./start-study-block";

const TIME_ZONE = "UTC";

/** Today's one lesson, started as its session block and answered, ready to complete. */
async function playLessonBlock({ energy }: { energy?: number } = {}) {
  const { lesson, skill, steps, user } = await setupPlayableLesson({
    steps: ["hook", "explanation", "check", "summary"],
  });

  if (energy !== undefined) {
    await prisma.userProgress.create({
      data: { currentEnergy: energy, lastActiveAt: new Date(), userId: user.id },
    });
  }

  const goal = await goalFixture({ timezone: TIME_ZONE, userId: user.id });

  const {
    items: [planItem],
  } = await planFixture({
    goalId: goal.id,
    items: [{ lessonId: lesson.id, skillId: skill.id, titleSnapshot: lesson.title }],
  });

  const today = await getTodayStudySession({ goalId: goal.id, timeZone: TIME_ZONE });
  const session = today.status === "ready" ? today.session : null;
  const block = session?.blocks.find((candidate) => candidate.lessonId === lesson.id);

  await startStudyBlock({ blockId: block?.id ?? "", input: {}, sessionId: session?.id ?? "" });

  const started = await startLibraryLesson({ input: { timeZone: TIME_ZONE }, lessonId: lesson.id });

  const runId = started.status === "started" ? started.run.runId : "";

  await checkLessonStep({
    input: {
      answer: { kind: "check", optionId: "likely" },
      durationMs: 4000,
      runId,
      timeZone: TIME_ZONE,
    },
    stepId: stepOfKind(steps, "check").id,
  });

  const complete = () =>
    completeLibraryLesson({ input: { runId, timeZone: TIME_ZONE }, lessonId: lesson.id });

  /** The same lesson played again from the start once its block is done, its check answered. */
  const replay = async () => {
    const again = await startLibraryLesson({ input: { timeZone: TIME_ZONE }, lessonId: lesson.id });
    const replayRunId = again.status === "started" ? again.run.runId : "";

    await checkLessonStep({
      input: {
        answer: { kind: "check", optionId: "likely" },
        durationMs: 4000,
        runId: replayRunId,
        timeZone: TIME_ZONE,
      },
      stepId: stepOfKind(steps, "check").id,
    });

    return completeLibraryLesson({
      input: { runId: replayRunId, timeZone: TIME_ZONE },
      lessonId: lesson.id,
    });
  };

  return { block, complete, planItem, replay };
}

describe("a lesson played as a session block", () => {
  it("completes the block, checks the plan and returns the moment with the lesson", async () => {
    const { block, complete, planItem } = await playLessonBlock();
    const outcome = await complete();

    expect(outcome).toMatchObject({
      completion: {
        // The lesson earns its own points; completing the day's only offered mission also pays
        // the full completion bonus through the study block.
        brainPower: 2 + 10,
        studyBlock: {
          blockId: block?.id,
          brainPower: 2 + 10 + 50,
          completedMissions: ["somethingNew"],
          fullMeal: { bonus: 50, paid: true },
          sessionBar: { completed: 1, total: 1 },
          sessionCompleted: true,
        },
      },
      status: "completed",
    });

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: planItem?.id ?? "" } }),
    ).resolves.toMatchObject({ status: "done" });
  });

  it("says the tenth of Energy the lesson reached once, not on a retry", async () => {
    const { complete } = await playLessonBlock({ energy: 79.9 });

    await expect(complete()).resolves.toMatchObject({
      completion: { studyBlock: { reached: { energy: 80 } } },
    });

    await expect(complete()).resolves.toMatchObject({
      completion: { studyBlock: { reached: { energy: null, level: null } } },
    });
  });

  it("celebrates a later replay as its own lesson, not as the block it already finished", async () => {
    const { complete, replay } = await playLessonBlock();
    await complete();

    await expect(replay()).resolves.toMatchObject({
      completion: { isFirstCompletion: false, studyBlock: null },
      status: "completed",
    });
  });

  it("doesn't celebrate Max Energy again for a learner already at it", async () => {
    const { complete } = await playLessonBlock({ energy: 100 });

    await expect(complete()).resolves.toMatchObject({
      completion: { studyBlock: { reached: { energy: null } } },
    });
  });
});
