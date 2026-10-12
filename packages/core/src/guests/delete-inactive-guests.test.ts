import { randomUUID } from "node:crypto";
import { del, list } from "@vercel/blob";
import { prisma } from "@zoonk/db";
import { feedbackFixture } from "@zoonk/testing/fixtures/feedback";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { describe, expect, it, vi } from "vitest";
import { deleteInactiveGuests } from "./delete-inactive-guests";

function daysAgo(days: number) {
  return new Date(Date.now() - days * MS_PER_DAY);
}

async function createUser({
  createdDaysAgo,
  isAnonymous,
  sessionUsedDaysAgo,
}: {
  createdDaysAgo: number;
  isAnonymous: boolean;
  sessionUsedDaysAgo?: number;
}) {
  const user = await userFixture();

  await prisma.user.update({
    data: { createdAt: daysAgo(createdDaysAgo), isAnonymous },
    where: { id: user.id },
  });

  if (sessionUsedDaysAgo !== undefined) {
    await prisma.session.create({
      data: {
        expiresAt: new Date(Date.now() + MS_PER_DAY),
        token: randomUUID(),
        updatedAt: daysAgo(sessionUsedDaysAgo),
        userId: user.id,
      },
    });
  }

  return user;
}

describe(deleteInactiveGuests, () => {
  it("deletes guests with no activity for 30 days and keeps everyone else", async () => {
    const [inactiveGuest, returningGuest, newGuest, oldAccount] = await Promise.all([
      createUser({ createdDaysAgo: 45, isAnonymous: true, sessionUsedDaysAgo: 40 }),
      createUser({ createdDaysAgo: 45, isAnonymous: true, sessionUsedDaysAgo: 2 }),
      createUser({ createdDaysAgo: 5, isAnonymous: true }),
      createUser({ createdDaysAgo: 400, isAnonymous: false }),
    ]);

    const goal = await goalFixture({ userId: inactiveGuest.id });

    const { deleted } = await deleteInactiveGuests();

    expect(deleted).toBeGreaterThanOrEqual(1);

    const remaining = await prisma.user.findMany({
      select: { id: true },
      where: { id: { in: [inactiveGuest.id, returningGuest.id, newGuest.id, oldAccount.id] } },
    });

    expect(remaining.map((user) => user.id).toSorted()).toStrictEqual(
      [returningGuest.id, newGuest.id, oldAccount.id].toSorted(),
    );

    await expect(prisma.goal.findUnique({ where: { id: goal.id } })).resolves.toBeNull();
  });

  it("keeps what an inactive guest's study teaches everyone, with nothing pointing at them", async () => {
    const [guest, returningGuest, skill, lesson] = await Promise.all([
      createUser({ createdDaysAgo: 45, isAnonymous: true, sessionUsedDaysAgo: 40 }),
      createUser({ createdDaysAgo: 45, isAnonymous: true, sessionUsedDaysAgo: 2 }),
      skillFixture(),
      libraryLessonFixture(),
    ]);

    const [item, returningItem] = await Promise.all([
      itemFixture({ skillId: skill.id }),
      itemFixture({ skillId: skill.id }),
    ]);

    const [feedback, returningAttempt] = await Promise.all([
      feedbackFixture({ email: "guest@example.test", message: "Loved the map", userId: guest.id }),
      attemptFixture({ isCorrect: true, itemId: returningItem.id, userId: returningGuest.id }),
      attemptFixture({ isCorrect: false, itemId: item.id, userId: guest.id }),
      learningEventFixture({
        contentIds: { lessonId: lesson.id },
        endedAt: daysAgo(40),
        seconds: 150,
        userId: guest.id,
      }),
    ]);

    await deleteInactiveGuests();

    await expect(
      Promise.all([
        prisma.anonymousFirstAnswer.findMany({ omit: { id: true }, where: { itemId: item.id } }),
        prisma.anonymousLessonPace.findMany({
          select: { seconds: true },
          where: { lessonId: lesson.id },
        }),
        prisma.feedback.findUnique({ where: { id: feedback.id } }),
      ]),
    ).resolves.toMatchObject([
      [{ isCorrect: false, itemId: item.id }],
      [{ seconds: 150 }],
      { email: null, message: "Loved the map", userId: null },
    ]);

    // A guest who came back keeps their own answers.
    await expect(
      Promise.all([
        prisma.attempt.count({ where: { id: returningAttempt.id } }),
        prisma.anonymousFirstAnswer.count({ where: { itemId: returningItem.id } }),
      ]),
    ).resolves.toStrictEqual([1, 0]);
  });

  it("deletes the pictures of an inactive guest's private course before the guest", async () => {
    vi.stubEnv("PRIVATE_BLOB_STORE_ID", "store_test");

    const [guest, returningGuest] = await Promise.all([
      createUser({ createdDaysAgo: 45, isAnonymous: true, sessionUsedDaysAgo: 40 }),
      createUser({ createdDaysAgo: 45, isAnonymous: true, sessionUsedDaysAgo: 2 }),
    ]);

    const pictureUrl = `https://store.private.blob.vercel-storage.com/images/${guest.id}/step.webp`;

    await Promise.all(
      [guest, returningGuest].map((owner) =>
        mediaAssetFixture({ ownerId: owner.id, url: pictureUrl, visibility: "private" }),
      ),
    );

    vi.mocked(list).mockImplementation(
      async ({ prefix } = {}) =>
        ({
          blobs: prefix === `images/${guest.id}/` ? [{ url: pictureUrl }] : [],
          cursor: undefined,
          folders: [],
          hasMore: false,
        }) as never,
    );

    await deleteInactiveGuests();

    expect(del).toHaveBeenCalledWith(
      [pictureUrl],
      expect.objectContaining({ storeId: "store_test" }),
    );

    expect(list).not.toHaveBeenCalledWith(
      expect.objectContaining({ prefix: `images/${returningGuest.id}/` }),
    );

    await expect(prisma.user.findUnique({ where: { id: guest.id } })).resolves.toBeNull();
    vi.unstubAllEnvs();
  });

  it("deletes the mind map of an inactive guest's private chapter, and keeps a shared chapter's", async () => {
    vi.stubEnv("PRIVATE_BLOB_STORE_ID", "store_test");

    const guest = await createUser({
      createdDaysAgo: 45,
      isAnonymous: true,
      sessionUsedDaysAgo: 40,
    });

    const mapUrl = `https://store.private.blob.vercel-storage.com/images/${guest.id}/map.webp`;

    const [privateChapter, sharedChapter] = await Promise.all([
      libraryChapterFixture({ ownerId: guest.id, visibility: "private" }),
      libraryChapterFixture(),
    ]);

    const sharedMap = await prisma.chapterMindMap.create({
      data: {
        chapterId: sharedChapter.id,
        imageUrl: "https://public.blob.vercel-storage.com/library/mind-maps/map.webp",
        language: "en",
        status: "completed",
      },
    });

    await prisma.chapterMindMap.create({
      data: { chapterId: privateChapter.id, imageUrl: mapUrl, language: "en", status: "completed" },
    });

    vi.mocked(list).mockImplementation(
      async ({ prefix } = {}) =>
        ({
          blobs: prefix === `images/${guest.id}/` ? [{ url: mapUrl }] : [],
          cursor: undefined,
          folders: [],
          hasMore: false,
        }) as never,
    );

    await deleteInactiveGuests();

    expect(del).toHaveBeenCalledWith([mapUrl], expect.objectContaining({ storeId: "store_test" }));

    await expect(
      prisma.chapter.findUnique({ where: { id: privateChapter.id } }),
    ).resolves.toBeNull();

    await expect(
      prisma.chapterMindMap.findUnique({ where: { id: sharedMap.id } }),
    ).resolves.not.toBeNull();

    vi.unstubAllEnvs();
  });
});
