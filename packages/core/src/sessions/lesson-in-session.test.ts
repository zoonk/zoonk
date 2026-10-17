import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
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

describe("a lesson played as a session block", () => {
  it("completes the block, checks the plan and returns the moment with the lesson", async () => {
    const { lesson, steps, user } = await setupPlayableLesson({
      steps: ["hook", "explanation", "check", "summary"],
    });

    const goal = await goalFixture({ timezone: TIME_ZONE, userId: user.id });
    const plan = await planFixture({ goalId: goal.id });

    const planItem = await planItemFixture({
      kind: "lesson",
      lessonId: lesson.id,
      planId: plan.id,
      position: 0,
      titleSnapshot: lesson.title,
    });

    const today = await getTodayStudySession({ goalId: goal.id, timeZone: TIME_ZONE });
    const session = today.status === "ready" ? today.session : null;
    const block = session?.blocks.find((candidate) => candidate.lessonId === lesson.id);

    await startStudyBlock({ blockId: block?.id ?? "", input: {}, sessionId: session?.id ?? "" });

    const started = await startLibraryLesson({
      input: { timeZone: TIME_ZONE },
      lessonId: lesson.id,
    });

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

    const outcome = await completeLibraryLesson({
      input: { runId, timeZone: TIME_ZONE },
      lessonId: lesson.id,
    });

    expect(outcome).toMatchObject({
      completion: {
        // The lesson earns its own points; completing the day's only offered mission also pays
        // the full completion bonus through the study block.
        brainPower: 2 + 10,
        studyBlock: {
          blockId: block?.id,
          brainPower: 2 + 10 + 50,
          fullMeal: { bonus: 50, paid: true },
          sessionBar: { completed: 1, total: 1 },
          sessionCompleted: true,
        },
      },
      status: "completed",
    });

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: planItem.id } }),
    ).resolves.toMatchObject({ status: "done" });
  });
});
