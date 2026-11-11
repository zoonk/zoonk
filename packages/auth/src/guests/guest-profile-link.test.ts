import { type ProfileQuestion, prisma } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { createLearner } from "./_test-utils/learner-data";
import { linkGuestAccount } from "./link-guest-account";

async function answer(
  userId: string,
  question: ProfileQuestion,
  outcome: "answered" | "declined" = "answered",
) {
  return prisma.profileAnswer.create({
    data: { answeredAt: new Date(), outcome, question, userId, version: 1 },
  });
}

async function fact(userId: string, question: ProfileQuestion, statement: string) {
  return prisma.memoryFact.create({
    data: {
      category: "context",
      origin: "said",
      profileAnswer: { favorites: [], picks: ["anime"] },
      sourceRef: { id: question, kind: "profile" },
      statement,
      userId,
    },
  });
}

async function learners() {
  const [userId, guestUserId] = await Promise.all([
    createLearner({ isAnonymous: false }),
    createLearner({ isAnonymous: true }),
  ]);

  await Promise.all([
    prisma.userLearningProfile.create({
      data: { learningNeeds: ["stepByStep"], memoryEnabled: false, soundsEnabled: true, userId },
    }),
    prisma.userLearningProfile.create({
      data: { learningNeeds: ["plainWords"], soundsEnabled: false, userId: guestUserId },
    }),
    answer(guestUserId, "learningSupport"),
  ]);

  return { guestUserId, userId };
}

describe("guest profile linking", () => {
  it.each(["answered", "declined"] as const)(
    "keeps account support settings together when %s",
    async (outcome) => {
      const { userId, guestUserId } = await learners();
      await answer(userId, "learningSupport", outcome);
      await linkGuestAccount({ account: { id: userId }, guestUserId });

      await expect(
        prisma.userLearningProfile.findUniqueOrThrow({ where: { userId } }),
      ).resolves.toMatchObject({
        learningNeeds: ["stepByStep"],
        memoryEnabled: false,
        soundsEnabled: true,
      });

      await expect(
        prisma.profileAnswer.findUniqueOrThrow({
          where: { userId_question: { question: "learningSupport", userId } },
        }),
      ).resolves.toMatchObject({ outcome });
    },
  );

  it("takes guest needs and disabled sounds when the account profile has no support answer", async () => {
    const { userId, guestUserId } = await learners();
    await linkGuestAccount({ account: { id: userId }, guestUserId });

    await expect(
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId } }),
    ).resolves.toMatchObject({
      learningNeeds: ["plainWords"],
      memoryEnabled: false,
      soundsEnabled: false,
    });
  });

  it.each([
    { account: "answered", expected: "masculine", profileRow: true },
    { account: "declined", expected: null, profileRow: true },
    { account: "declined", expected: null, profileRow: false },
    { account: null, expected: "feminine", profileRow: true },
    { account: null, expected: "feminine", profileRow: false },
  ] as const)(
    "keeps the account's address answer or decline, else takes the guest's: $account, profile row $profileRow",
    async ({ account, expected, profileRow }) => {
      const { userId, guestUserId } = await learners();

      await Promise.all([
        profileRow
          ? prisma.userLearningProfile.update({
              data: { addressForm: account === "answered" ? "masculine" : null },
              where: { userId },
            })
          : prisma.userLearningProfile.delete({ where: { userId } }),
        prisma.userLearningProfile.update({
          data: { addressForm: "feminine" },
          where: { userId: guestUserId },
        }),
        answer(guestUserId, "addressForm"),
        ...(account ? [answer(userId, "addressForm", account)] : []),
      ]);

      await linkGuestAccount({ account: { id: userId }, guestUserId });

      await expect(
        prisma.userLearningProfile.findUniqueOrThrow({ where: { userId } }),
      ).resolves.toMatchObject({ addressForm: expected });
    },
  );

  it("honors an account decline before moving conditions, facts and question rows", async () => {
    const { userId, guestUserId } = await learners();

    await Promise.all([
      answer(userId, "conditions", "declined"),
      answer(userId, "watch"),
      answer(guestUserId, "watch"),
      answer(guestUserId, "play"),
      answer(guestUserId, "conditions"),
      fact(userId, "watch", "Account watches anime"),
      fact(guestUserId, "watch", "Guest watches anime"),
      fact(guestUserId, "play", "Guest plays chess"),
      prisma.learnerCondition.create({ data: { condition: "adhd", userId: guestUserId } }),
    ]);

    await linkGuestAccount({ account: { id: userId }, guestUserId });

    await expect(prisma.learnerCondition.findMany({ where: { userId } })).resolves.toStrictEqual(
      [],
    );

    const facts = await prisma.memoryFact.findMany({
      orderBy: { statement: "asc" },
      where: { userId },
    });

    expect(facts.map((row) => row.statement)).toStrictEqual([
      "Account watches anime",
      "Guest plays chess",
    ]);

    await expect(
      prisma.profileAnswer.findUniqueOrThrow({
        where: { userId_question: { question: "play", userId } },
      }),
    ).resolves.toMatchObject({ outcome: "answered" });
  });

  it("moves the guest's consented conditions whole when the account never answered", async () => {
    const { userId, guestUserId } = await learners();
    await answer(guestUserId, "conditions");

    await prisma.learnerCondition.createMany({
      data: [
        { condition: "adhd", userId: guestUserId },
        { condition: "other", note: "Own words", userId: guestUserId },
      ],
    });

    await linkGuestAccount({ account: { id: userId }, guestUserId });

    await expect(prisma.learnerCondition.findMany({ where: { userId } })).resolves.toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ condition: "adhd" }),
        expect.objectContaining({ condition: "other", note: "Own words" }),
      ]),
    );

    await expect(
      prisma.profileAnswer.findUniqueOrThrow({
        where: { userId_question: { question: "conditions", userId } },
      }),
    ).resolves.toMatchObject({ outcome: "answered" });
  });

  it("moves the guest's profile facts to an account that never answered a question", async () => {
    const [userId, guestUserId] = await Promise.all([
      createLearner({ isAnonymous: false }),
      createLearner({ isAnonymous: true }),
    ]);

    await Promise.all([answer(guestUserId, "watch"), fact(guestUserId, "watch", "Watches anime")]);
    await linkGuestAccount({ account: { id: userId }, guestUserId });

    await expect(
      prisma.memoryFact.findMany({ select: { statement: true }, where: { userId } }),
    ).resolves.toStrictEqual([{ statement: "Watches anime" }]);
  });
});
