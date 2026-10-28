import "server-only";
import { deleteUserBlobs } from "@zoonk/auth/user-blobs";
import { prisma } from "@zoonk/db";
import { anonymizeLearnerRecords } from "@zoonk/db/anonymous-records";
import { MS_PER_DAY } from "@zoonk/utils/date";

const GUEST_INACTIVE_DAYS = 30;
const GUEST_BATCH_SIZE = 500;

const SWEEP_TIMEOUT_MS = 120_000;

/** Better Auth refreshes active sessions, so their last update identifies returning guests. */
function getInactiveGuestWhere(now: Date) {
  const cutoff = new Date(now.getTime() - GUEST_INACTIVE_DAYS * MS_PER_DAY);

  return {
    createdAt: { lt: cutoff },
    isAnonymous: true,
    sessions: { none: { updatedAt: { gte: cutoff } } },
  };
}

async function deleteGuestFiles(guestIds: string[]): Promise<void> {
  const owners = await prisma.user.findMany({
    select: { id: true },
    where: {
      OR: [
        { ownedMediaAssets: { some: {} } },
        { ownedChapters: { some: { mindMap: { imageUrl: { not: null } } } } },
      ],
      id: { in: guestIds },
    },
  });

  await Promise.all(owners.map((owner) => deleteUserBlobs(owner.id)));
}

/** Deletes one batch; scheduled callers repeat until deleted is zero. Rechecks inactivity atomically to preserve returning guests. */
export async function deleteInactiveGuests(): Promise<{ deleted: number }> {
  const where = getInactiveGuestWhere(new Date());

  const guests = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true },
    take: GUEST_BATCH_SIZE,
    where,
  });

  const guestIds = guests.map((guest) => guest.id);

  await deleteGuestFiles(guestIds);

  const count = await prisma.$transaction(
    async (transaction) => {
      const inactive = await transaction.user.findMany({
        select: { id: true },
        where: { ...where, id: { in: guestIds } },
      });

      const userIds = inactive.map((guest) => guest.id);

      await anonymizeLearnerRecords({ emails: [], transaction, userIds });
      const deleted = await transaction.user.deleteMany({ where: { id: { in: userIds } } });

      return deleted.count;
    },
    { timeout: SWEEP_TIMEOUT_MS },
  );

  return { deleted: count };
}
