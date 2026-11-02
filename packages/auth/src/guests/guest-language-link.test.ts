import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { createLearner } from "./_test-utils/learner-data";
import { linkGuestAccount } from "./link-guest-account";

const OLDER = new Date("2026-09-01T00:00:00Z");
const NEWER = new Date("2026-09-02T00:00:00Z");

describe("guest language linking", () => {
  it("keeps the latest skill snapshot, uses the larger window on a date tie, and de-duplicates words before deleting the guest", async () => {
    const [accountId, guestId] = await Promise.all([
      createLearner({ isAnonymous: false }),
      createLearner({ isAnonymous: true }),
    ]);

    const [guestReading, accountListening, guestSpeaking, accountWriting, tiedAccount] =
      await Promise.all([
        prisma.languageSkillLevel.create({
          data: {
            language: "en",
            score: 1.5,
            skill: "reading",
            startScore: 2,
            updatedAt: NEWER,
            userId: guestId,
            windowCeiling: 1.5,
            windowCorrect: 2,
            windowTotal: 5,
          },
        }),
        prisma.languageSkillLevel.create({
          data: {
            language: "en",
            score: 1,
            skill: "listening",
            startScore: 1.5,
            updatedAt: NEWER,
            userId: accountId,
            windowCeiling: 1,
            windowCorrect: 1,
            windowTotal: 4,
          },
        }),
        prisma.languageSkillLevel.create({
          data: {
            language: "en",
            score: 2,
            skill: "speaking",
            startScore: 1.5,
            updatedAt: NEWER,
            userId: guestId,
            windowCeiling: 3,
            windowCorrect: 8,
            windowTotal: 10,
          },
        }),
        prisma.languageSkillLevel.create({
          data: {
            language: "en",
            score: 2.5,
            skill: "writing",
            startScore: 2,
            updatedAt: NEWER,
            userId: accountId,
            windowCeiling: 3,
            windowCorrect: 7,
            windowTotal: 9,
          },
        }),
        prisma.languageSkillLevel.create({
          data: {
            language: "pt",
            score: 1,
            skill: "reading",
            startScore: 0,
            updatedAt: NEWER,
            userId: accountId,
            windowTotal: 2,
          },
        }),
      ]);

    await prisma.languageSkillLevel.createMany({
      data: [
        {
          language: "en",
          score: 2,
          skill: "reading",
          startScore: 2,
          updatedAt: OLDER,
          userId: accountId,
        },
        {
          language: "en",
          score: 2,
          skill: "listening",
          startScore: 2,
          updatedAt: OLDER,
          userId: guestId,
        },
        {
          language: "en",
          score: 3,
          skill: "speaking",
          startScore: 3,
          updatedAt: NEWER,
          userId: accountId,
          windowTotal: 3,
        },
        {
          language: "en",
          score: 3,
          skill: "writing",
          startScore: 3,
          updatedAt: NEWER,
          userId: guestId,
          windowTotal: 2,
        },
        {
          language: "pt",
          score: 2,
          skill: "reading",
          startScore: 2,
          updatedAt: NEWER,
          userId: guestId,
          windowTotal: 2,
        },
        {
          language: "es",
          score: 0.5,
          skill: "writing",
          startScore: 0,
          updatedAt: OLDER,
          userId: guestId,
          windowCorrect: 4,
          windowTotal: 6,
        },
        {
          language: "fr",
          score: 3,
          skill: "reading",
          startScore: 3,
          updatedAt: OLDER,
          userId: accountId,
        },
      ],
    });

    const sharedWord = randomUUID();
    const guestWord = randomUUID();
    const accountWord = randomUUID();

    await prisma.learnerWord.createMany({
      data: [
        { language: "en", learnedAt: OLDER, text: "hello", userId: accountId, wordId: sharedWord },
        { language: "en", learnedAt: NEWER, text: "hello", userId: guestId, wordId: sharedWord },
        { language: "es", learnedAt: NEWER, text: "hola", userId: guestId, wordId: guestWord },
        {
          language: "fr",
          learnedAt: OLDER,
          text: "bonjour",
          userId: accountId,
          wordId: accountWord,
        },
      ],
    });

    await linkGuestAccount({ account: { id: accountId }, guestUserId: guestId });

    const levels = await prisma.languageSkillLevel.findMany({ where: { userId: accountId } });

    expect(levels).toHaveLength(7);

    for (const source of [
      guestReading,
      accountListening,
      guestSpeaking,
      accountWriting,
      tiedAccount,
    ]) {
      expect(levels).toContainEqual(
        expect.objectContaining({
          language: source.language,
          score: source.score,
          skill: source.skill,
          startScore: source.startScore,
          updatedAt: source.updatedAt,
          windowCeiling: source.windowCeiling,
          windowCorrect: source.windowCorrect,
          windowTotal: source.windowTotal,
        }),
      );
    }

    expect(levels).toContainEqual(
      expect.objectContaining({
        language: "es",
        score: 0.5,
        skill: "writing",
        startScore: 0,
        updatedAt: OLDER,
        windowCorrect: 4,
        windowTotal: 6,
      }),
    );

    expect(levels).toContainEqual(expect.objectContaining({ language: "fr", score: 3 }));

    const words = await prisma.learnerWord.findMany({ where: { userId: accountId } });

    expect(words).toHaveLength(3);

    expect(words).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          language: "en",
          learnedAt: OLDER,
          text: "hello",
          wordId: sharedWord,
        }),
        expect.objectContaining({
          language: "es",
          learnedAt: NEWER,
          text: "hola",
          wordId: guestWord,
        }),
        expect.objectContaining({
          language: "fr",
          learnedAt: OLDER,
          text: "bonjour",
          wordId: accountWord,
        }),
      ]),
    );

    await expect(prisma.user.findUnique({ where: { id: guestId } })).resolves.toBeNull();
  });

  it.each([false, true])(
    "merges concurrent guests' first language evidence without private courses (with words: %s)",
    async (withWords) => {
      const [accountId, firstGuestId, secondGuestId] = await Promise.all([
        createLearner({ isAnonymous: false }),
        createLearner({ isAnonymous: true }),
        createLearner({ isAnonymous: true }),
      ]);

      const wordId = randomUUID();

      await Promise.all([
        prisma.languageSkillLevel.createMany({
          data: [
            {
              language: "en",
              score: 2,
              skill: "reading",
              startScore: 1,
              updatedAt: OLDER,
              userId: firstGuestId,
              windowTotal: 3,
            },
            {
              language: "en",
              score: 1.5,
              skill: "reading",
              startScore: 2,
              updatedAt: NEWER,
              userId: secondGuestId,
              windowCorrect: 2,
              windowTotal: 4,
            },
          ],
        }),
        withWords &&
          prisma.learnerWord.createMany({
            data: [
              { language: "en", text: "hello", userId: firstGuestId, wordId },
              { language: "en", text: "hello", userId: secondGuestId, wordId },
            ],
          }),
      ]);

      await Promise.all([
        linkGuestAccount({ account: { id: accountId }, guestUserId: firstGuestId }),
        linkGuestAccount({ account: { id: accountId }, guestUserId: secondGuestId }),
      ]);

      await expect(
        prisma.languageSkillLevel.findMany({ where: { userId: accountId } }),
      ).resolves.toMatchObject([
        {
          language: "en",
          score: 1.5,
          skill: "reading",
          startScore: 2,
          updatedAt: NEWER,
          windowCorrect: 2,
          windowTotal: 4,
        },
      ]);

      await expect(
        prisma.learnerWord.count({ where: { userId: accountId, wordId } }),
      ).resolves.toBe(withWords ? 1 : 0);

      await expect(
        prisma.user.count({ where: { id: { in: [firstGuestId, secondGuestId] } } }),
      ).resolves.toBe(0);
    },
  );
});
