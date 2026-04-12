import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, test } from "vitest";
import { fillDecayGaps } from "./daily-progress";

describe(fillDecayGaps, () => {
  test("keeps one daily progress row per user and day", async () => {
    const user = await userFixture();
    const userId = Number(user.id);
    const date = new Date(Date.UTC(2026, 0, 2));

    await prisma.dailyProgress.create({
      data: {
        date,
        dayOfWeek: date.getUTCDay(),
        energyAtEnd: 49,
        userId,
      },
    });

    await expect(
      prisma.dailyProgress.create({
        data: {
          date,
          dayOfWeek: date.getUTCDay(),
          energyAtEnd: 48,
          userId,
        },
      }),
    ).rejects.toHaveProperty("code", "P2002");
  });

  test("skips decay rows for days that already have progress", async () => {
    const user = await userFixture();
    const userId = Number(user.id);
    const gapDate = new Date(Date.UTC(2026, 0, 2));

    await prisma.dailyProgress.create({
      data: {
        date: gapDate,
        dayOfWeek: gapDate.getUTCDay(),
        energyAtEnd: 49,
        userId,
      },
    });

    await prisma.$transaction((tx) =>
      fillDecayGaps({
        currentEnergy: 50,
        lastActiveDate: new Date(Date.UTC(2026, 0, 1)),
        todayDate: new Date(Date.UTC(2026, 0, 3)),
        tx,
        userId,
      }),
    );

    const rows = await prisma.dailyProgress.findMany({
      where: { date: gapDate, userId },
    });

    expect(rows).toHaveLength(1);
  });
});
