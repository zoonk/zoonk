import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  setupPlayableLesson,
  stepOfKind,
} from "../lesson-player/_test-utils/playable-lesson-setup";
import { checkLessonStep } from "../lesson-player/check-lesson-step";
import { completeLibraryLesson } from "../lesson-player/complete-library-lesson";
import { startLibraryLesson } from "../lesson-player/start-library-lesson";
import { finishLessonBlock } from "./finish-study-block";

// The real database can't drop the connection between the lesson's commit and its day's settlement.
vi.mock("./finish-study-block", { spy: true });

const TIME_ZONE = "UTC";
const AFTERNOON = new Date("2026-09-30T15:00:00Z");
const NEXT_MORNING = new Date("2026-10-01T09:00:00Z");

async function failSettlingLessonFromPlan() {
  vi.setSystemTime(AFTERNOON);

  const { lesson, skill, steps, user } = await setupPlayableLesson({ steps: ["check"] });
  const goal = await goalFixture({ timezone: TIME_ZONE, userId: user.id });

  const {
    items: [planItem],
  } = await planFixture({ goalId: goal.id, items: [{ lessonId: lesson.id, skillId: skill.id }] });

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

  vi.mocked(finishLessonBlock).mockRejectedValueOnce(new Error("Connection lost"));

  const complete = () =>
    completeLibraryLesson({ input: { runId, timeZone: TIME_ZONE }, lessonId: lesson.id });

  await expect(complete()).rejects.toThrow("Connection lost");

  return { complete, goal, planItemId: planItem?.id ?? "" };
}

describe("a lesson whose day fails to settle after it finished", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("still shows its block and plan item done on Today without a retry", async () => {
    const { goal, planItemId } = await failSettlingLessonFromPlan();

    await expect(
      prisma.studySessionBlock.findFirstOrThrow({ where: { session: { goalId: goal.id } } }),
    ).resolves.toMatchObject({ status: "completed" });

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: planItemId } }),
    ).resolves.toMatchObject({ status: "done" });
  });

  it("settles the day it finished in when the learner retries the next day", async () => {
    const { complete, goal } = await failSettlingLessonFromPlan();

    vi.setSystemTime(NEXT_MORNING);

    await expect(complete()).resolves.toMatchObject({
      completion: { studyBlock: { fullMeal: { paid: true }, sessionCompleted: true } },
      status: "completed",
    });

    await expect(
      prisma.studySession.findFirstOrThrow({ where: { goalId: goal.id } }),
    ).resolves.toMatchObject({ localDate: new Date("2026-09-30T00:00:00Z"), status: "completed" });
  });
});
