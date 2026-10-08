import { prisma } from "@zoonk/db";
import {
  guardianLinkFixture,
  learningProfileFixture,
} from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { toUTCMidnight } from "@zoonk/utils/date";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { updateLearningProfile } from "../profile/update-learning-profile";
import { getDailyTimeLimitStatus } from "./get-daily-time-limit";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => {} })),
  headers: vi.fn(async () => new Headers()),
}));

const TWENTY_MINUTES_IN_SECONDS = 1200;

async function studiedToday(userId: string) {
  await prisma.dailyProgress.create({
    data: {
      date: toUTCMidnight(new Date()),
      dayOfWeek: 0,
      timeSpentSeconds: TWENTY_MINUTES_IN_SECONDS,
      userId,
    },
  });
}

describe(getDailyTimeLimitStatus, () => {
  it("counts the day against the learner's own limit", async () => {
    const learner = await userFixture();
    mockSession(learner.id);

    await expect(updateLearningProfile({ dailyLimitMinutes: 30 })).resolves.toMatchObject({
      profile: { dailyLimitMinutes: 30 },
      status: "updated",
    });

    await studiedToday(learner.id);

    await expect(getDailyTimeLimitStatus()).resolves.toStrictEqual({
      limitMinutes: 30,
      reached: false,
      remainingMinutes: 10,
      usedMinutes: 20,
    });

    await updateLearningProfile({ dailyLimitMinutes: null });

    await expect(getDailyTimeLimitStatus()).resolves.toMatchObject({
      limitMinutes: null,
      reached: false,
    });
  });

  it("applies the stricter of the learner's limit and a guardian's", async () => {
    const teen = await userFixture();

    await Promise.all([
      learningProfileFixture({ dailyLimitMinutes: 60, userId: teen.id }),
      guardianLinkFixture({ dailyLimitMinutes: 15, status: "active", userId: teen.id }),
      studiedToday(teen.id),
    ]);

    mockSession(teen.id);

    await expect(getDailyTimeLimitStatus()).resolves.toStrictEqual({
      limitMinutes: 15,
      reached: true,
      remainingMinutes: 0,
      usedMinutes: 20,
    });
  });
});
