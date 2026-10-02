import { randomUUID } from "node:crypto";
import { del, list } from "@vercel/blob";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { describe, expect, it, vi } from "vitest";
import { deleteInactiveGuests } from "./delete-inactive-guests";

// Blob storage is an external service; tests list the guest's pictures from memory.
vi.mock("@vercel/blob", () => ({ del: vi.fn(), list: vi.fn() }));

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
});
