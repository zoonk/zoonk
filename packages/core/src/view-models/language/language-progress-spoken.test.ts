import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getLanguageProgressView } from "./get-language-progress-view";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const MINUTE_MS = 60_000;

function spoken({
  answeredAt = new Date(),
  minutes,
  targetLanguage,
  userId,
}: {
  answeredAt?: Date;
  minutes: number;
  targetLanguage: string | null;
  userId: string;
}) {
  return attemptFixture({
    answer: { kind: "spoken", transcript: "How much is the rent?" },
    answeredAt,
    durationMs: minutes * MINUTE_MS,
    targetLanguage,
    userId,
  });
}

describe("minutes spoken on a language goal's progress", () => {
  it("counts only this month's spoken answers in the goal's language", async () => {
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);

    await Promise.all([
      spoken({ minutes: 3, targetLanguage: "en", userId: user.id }),
      spoken({ minutes: 5, targetLanguage: "es", userId: user.id }),
      spoken({ minutes: 4, targetLanguage: null, userId: user.id }),
      spoken({
        answeredAt: new Date(Date.now() - 40 * MS_PER_DAY),
        minutes: 7,
        targetLanguage: "en",
        userId: user.id,
      }),
      attemptFixture({ durationMs: 9 * MINUTE_MS, targetLanguage: "en", userId: user.id }),
    ]);

    const result = await getLanguageProgressView({ goalId: goal.id });

    if (result.status !== "ready") {
      throw new Error(result.status);
    }

    expect(result.progress.recent.minutesSpoken).toBe(3);
  });
});
