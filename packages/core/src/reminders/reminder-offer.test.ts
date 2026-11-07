import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockAccountSession } from "../_test-utils/mock-session";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import { SESSION_NOW, sessionGoalFixture } from "../sessions/_test-utils/session-goal";
import { finishStudyBlock } from "../sessions/finish-study-block";
import { startStudyBlock } from "../sessions/start-study-block";
import { claimStudyReminderOffer } from "./claim-study-reminder-offer";
import { updateStudyReminder } from "./update-study-reminder";

async function finishFirstLesson() {
  const user = await userFixture();
  mockAccountSession({ user });

  const { goal } = await sessionGoalFixture({
    goal: { studyTime: "07:30" },
    lessons: 2,
    userId: user.id,
  });

  const today = await getTodayStudySession({ goalId: goal.id });

  if (today.status !== "ready") {
    throw new Error("Expected today's session");
  }

  const block = today.session.blocks.find((candidate) => candidate.kind === "learn");

  if (!block?.lessonId) {
    throw new Error("Expected a lesson block");
  }

  const request = { blockId: block.id, input: {}, sessionId: today.session.id };
  await startStudyBlock(request);

  await learningEventFixture({
    contentIds: { lessonId: block.lessonId, studySessionId: today.session.id },
    endedAt: new Date(),
    userId: user.id,
  });

  return { finish: () => finishStudyBlock(request) };
}

describe("reminder offer after a plan lesson", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("offers reminders at the goal's study time until the offer is shown", async () => {
    const lesson = await finishFirstLesson();

    await expect(lesson.finish()).resolves.toMatchObject({
      completion: { reminderOffer: { time: "07:30", timeZone: "UTC" } },
    });

    await claimStudyReminderOffer({ locale: "en" });

    await expect(lesson.finish()).resolves.toMatchObject({ completion: { reminderOffer: null } });
  });

  it("doesn't offer reminders a learner already turned on", async () => {
    const lesson = await finishFirstLesson();
    await updateStudyReminder({ emailOn: true, locale: "en" });

    await expect(lesson.finish()).resolves.toMatchObject({ completion: { reminderOffer: null } });
  });
});
