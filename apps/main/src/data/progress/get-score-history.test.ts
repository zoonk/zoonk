import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signInAsCurrentUser } from "../../../test-utils/auth";
import { getScore } from "./get-score";
import { getScoreHistory } from "./get-score-history";

describe(getScoreHistory, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for unauthenticated users", async () => {
    await expect(getScoreHistory()).resolves.toBeNull();
  });

  it("returns null when the learner has no answered questions", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    await prisma.dailyProgress.create({
      data: { date: new Date(), dayOfWeek: new Date().getDay(), userId: user.id },
    });

    await expect(getScoreHistory()).resolves.toBeNull();
  });

  it("uses weighted totals for the rolling score and each weekly trend point", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-23T12:00:00.000Z"));

    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    await prisma.dailyProgress.createMany({
      data: [
        {
          correctAnswers: 0,
          date: new Date("2026-04-23T00:00:00.000Z"),
          dayOfWeek: 4,
          incorrectAnswers: 100,
          userId: user.id,
        },
        {
          correctAnswers: 1,
          date: new Date("2026-07-13T00:00:00.000Z"),
          dayOfWeek: 1,
          userId: user.id,
        },
        {
          date: new Date("2026-07-14T00:00:00.000Z"),
          dayOfWeek: 2,
          incorrectAnswers: 9,
          userId: user.id,
        },
        {
          correctAnswers: 8,
          date: new Date("2026-07-20T00:00:00.000Z"),
          dayOfWeek: 1,
          incorrectAnswers: 2,
          userId: user.id,
        },
      ],
    });

    const result = await getScoreHistory({ locale: "en" });

    expect(result).toMatchObject({
      correctAnswers: 9,
      incorrectAnswers: 11,
      periodEnd: new Date("2026-07-23T00:00:00.000Z"),
      periodStart: new Date("2026-04-25T00:00:00.000Z"),
      score: 45,
      totalAnswers: 20,
    });

    expect(result?.dataPoints).toStrictEqual([
      expect.objectContaining({
        correctAnswers: 1,
        date: new Date("2026-07-13T00:00:00.000Z"),
        incorrectAnswers: 9,
        score: 10,
        totalAnswers: 10,
      }),
      expect.objectContaining({
        correctAnswers: 8,
        date: new Date("2026-07-20T00:00:00.000Z"),
        incorrectAnswers: 2,
        score: 80,
        totalAnswers: 10,
      }),
    ]);
  });

  it("localizes weekly trend labels without changing the score window", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-23T12:00:00.000Z"));

    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    await prisma.dailyProgress.create({
      data: {
        correctAnswers: 4,
        date: new Date("2026-07-20T00:00:00.000Z"),
        dayOfWeek: 1,
        incorrectAnswers: 1,
        userId: user.id,
      },
    });

    const [english, portuguese] = await Promise.all([
      getScoreHistory({ locale: "en" }),
      getScoreHistory({ locale: "pt" }),
    ]);

    expect(english?.dataPoints[0]?.label).not.toBe(portuguese?.dataPoints[0]?.label);
    expect(english?.periodStart).toStrictEqual(portuguese?.periodStart);
    expect(english?.score).toBe(portuguese?.score);
  });

  it("keeps the headline and history on the same 90 local dates ahead of UTC", async () => {
    const now = new Date("2026-07-23T12:30:00.000Z");
    const timeZone = "Pacific/Kiritimati";
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });

    await prisma.dailyProgress.createMany({
      data: [
        {
          correctAnswers: 10,
          date: new Date("2026-04-25T00:00:00.000Z"),
          dayOfWeek: 6,
          userId: user.id,
        },
        {
          correctAnswers: 1,
          date: new Date("2026-04-26T00:00:00.000Z"),
          dayOfWeek: 0,
          userId: user.id,
        },
        {
          correctAnswers: 2,
          date: new Date("2026-07-24T00:00:00.000Z"),
          dayOfWeek: 5,
          userId: user.id,
        },
        {
          date: new Date("2026-07-25T00:00:00.000Z"),
          dayOfWeek: 6,
          incorrectAnswers: 10,
          userId: user.id,
        },
      ],
    });

    const [headline, history] = await Promise.all([
      getScore({ now, timeZone }),
      getScoreHistory({ locale: "en", now, timeZone }),
    ]);

    expect(headline).toStrictEqual({
      correctAnswers: 3,
      incorrectAnswers: 0,
      score: 100,
      totalAnswers: 3,
    });

    expect(history).toMatchObject({
      correctAnswers: 3,
      incorrectAnswers: 0,
      periodEnd: new Date("2026-07-24T00:00:00.000Z"),
      periodStart: new Date("2026-04-26T00:00:00.000Z"),
      score: 100,
      totalAnswers: 3,
    });
  });
});
