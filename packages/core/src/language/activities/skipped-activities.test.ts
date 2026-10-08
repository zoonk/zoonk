import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { setupPlayableLesson } from "../../lesson-player/_test-utils/playable-lesson-setup";
import { completeLibraryLesson } from "../../lesson-player/complete-library-lesson";
import { startLibraryLesson } from "../../lesson-player/start-library-lesson";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { changeLanguageActivity, getLanguageActivitySettings } from "./skipped-activities";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(),
}));

const TIME_ZONE = "UTC";

/** A written English lesson for a Portuguese speaker with a plan for English. */
async function languageLessonSetup() {
  const setup = await setupPlayableLesson({ steps: ["explanation", "typedAnswer", "summary"] });

  await prisma.lesson.update({
    data: { language: "pt", targetLanguage: "en" },
    where: { id: setup.lesson.id },
  });

  const goal = await goalFixture({
    kind: "language",
    language: "pt",
    targetLanguage: "en",
    userId: setup.user.id,
  });

  const plan = await planFixture({ goalId: goal.id });

  return { ...setup, goal, plan };
}

async function startAndComplete(lessonId: string) {
  const started = await startLibraryLesson({ input: { timeZone: TIME_ZONE }, lessonId });

  if (started.status !== "started") {
    throw new Error(started.status);
  }

  return completeLibraryLesson({
    input: { runId: started.run.runId, timeZone: TIME_ZONE },
    lessonId,
  });
}

describe("skipping language activities", () => {
  beforeEach(() => {
    vi.mocked(isRateLimited).mockResolvedValue(false);
  });

  it("leaves writing out of the plan until it's brought back", async () => {
    const { plan, user } = await languageLessonSetup();
    mockSession(user.id);

    await expect(getLanguageActivitySettings({ targetLanguage: "en" })).resolves.toStrictEqual({
      skipped: [],
    });

    const skipped = await changeLanguageActivity({
      activity: "writing",
      skip: true,
      targetLanguage: "en",
    });

    expect(skipped.status).toBe("applied");

    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(parsePlanSettings(saved.settings).skippedActivities).toStrictEqual(["writing"]);

    await changeLanguageActivity({ activity: "writing", skip: false, targetLanguage: "en" });

    await expect(getLanguageActivitySettings({ targetLanguage: "en" })).resolves.toStrictEqual({
      skipped: [],
    });
  });

  it("finishes a language lesson without its writing screens once writing is skipped", async () => {
    const { lesson, user } = await languageLessonSetup();
    mockSession(user.id);

    await expect(startAndComplete(lesson.id)).resolves.toStrictEqual({ status: "invalid" });

    await changeLanguageActivity({ activity: "writing", skip: true, targetLanguage: "en" });

    await expect(startAndComplete(lesson.id)).resolves.toMatchObject({ status: "completed" });
  });

  it("offers nothing to change without a goal for the language", async () => {
    const { user } = await setupPlayableLesson();
    mockSession(user.id);

    await expect(getLanguageActivitySettings({ targetLanguage: "ja" })).resolves.toBeNull();

    await expect(
      changeLanguageActivity({ activity: "speaking", skip: true, targetLanguage: "ja" }),
    ).resolves.toStrictEqual({ status: "noGoal" });
  });
});
