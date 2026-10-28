import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { celebrateProgress } from "./celebrate-progress";

async function learnerAt(brainPower: number) {
  const user = await userFixture();

  await prisma.userProgress.create({
    data: { currentEnergy: 80.5, totalBrainPower: BigInt(brainPower), userId: user.id },
  });

  return user;
}

describe(celebrateProgress, () => {
  it("records the belt the work crossed and celebrates it with the level and Energy it reached", async () => {
    const user = await learnerAt(2510);

    const celebration = await celebrateProgress({
      progress: {
        brainPower: { after: 2510, before: 2490 },
        energy: { after: 80.5, before: 79.9 },
      },
      userId: user.id,
    });

    expect(celebration).toMatchObject({
      ceremony: { key: "yellow", kind: "belt", shownAt: null },
      reached: { energy: 80, level: { color: "yellow", level: 1 } },
    });

    await expect(
      prisma.milestone.findMany({ select: { key: true, kind: true }, where: { userId: user.id } }),
    ).resolves.toStrictEqual([{ key: "yellow", kind: "belt" }]);
  });

  it("counts the day's bonus the work paid, as a block's level does", async () => {
    const user = await learnerAt(295);

    const celebration = await celebrateProgress({
      progress: { brainPower: { after: 245, before: 240 }, energy: { after: 80.5, before: 80.4 } },
      settleDay: () =>
        Promise.resolve({ fullMealPaid: true, fullMealReward: { after: 295, before: 245 } }),
      userId: user.id,
    });

    expect(celebration.reached).toStrictEqual({
      energy: null,
      level: { color: "white", level: 2 },
    });
  });

  it("never counts what other work added meanwhile, such as another tab's", async () => {
    const user = await learnerAt(300);

    const celebration = await celebrateProgress({
      progress: { brainPower: { after: 248, before: 246 }, energy: { after: 80.5, before: 80.4 } },
      userId: user.id,
    });

    expect(celebration.reached).toStrictEqual({ energy: null, level: null });
  });

  it("records the work's belt before its day settles, so a day that fails keeps it", async () => {
    const user = await learnerAt(2510);

    await expect(
      celebrateProgress({
        progress: {
          brainPower: { after: 2510, before: 2490 },
          energy: { after: 80.5, before: 80.4 },
        },
        settleDay: () => Promise.reject(new Error("The missions couldn't settle")),
        userId: user.id,
      }),
    ).rejects.toThrow("The missions couldn't settle");

    await expect(
      prisma.milestone.findMany({ select: { key: true }, where: { userId: user.id } }),
    ).resolves.toStrictEqual([{ key: "yellow" }]);
  });

  it("reaches nothing on a repeat, and still opens a milestone not shown yet", async () => {
    const user = await learnerAt(2510);
    await prisma.milestone.create({ data: { key: "yellow", kind: "belt", userId: user.id } });

    await expect(celebrateProgress({ progress: null, userId: user.id })).resolves.toMatchObject({
      ceremony: { key: "yellow", kind: "belt" },
      reached: { energy: null, level: null },
    });
  });
});
