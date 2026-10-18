import "server-only";
import { deleteUserBlobs } from "@zoonk/auth/user-blobs";
import { prisma } from "@zoonk/db";
import { anonymizeLearnerRecords } from "@zoonk/db/anonymous-records";
import { MS_PER_DAY } from "@zoonk/utils/date";

const GUEST_INACTIVE_DAYS = 30;
const GUEST_BATCH_SIZE = 500;

/** Keeping a batch's anonymous records copies all their answers and lessons, past the default. */
const SWEEP_TIMEOUT_MS = 120_000;

/**
 * A guest is inactive when it's older than 30 days and none of its sessions was used since. Better
 * Auth refreshes a session while it's in use, so the last session update is the last visit.
 */
function getInactiveGuestWhere(now: Date) {
  const cutoff = new Date(now.getTime() - GUEST_INACTIVE_DAYS * MS_PER_DAY);

  return {
    createdAt: { lt: cutoff },
    isAnonymous: true,
    sessions: { none: { updatedAt: { gte: cutoff } } },
  };
}

/**
 * A guest's only private files are the pictures of their private course, its lessons' and its
 * chapters' mind maps (guests can't upload), so only guests who own some have files to delete,
 * first, like an account's.
 */
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

/**
 * Deletes guests with no activity for 30 days, as the privacy policy promises, with everything they
 * created, keeping only what their study teaches everyone, anonymously (`anonymizeLearnerRecords`).
 * A scheduled job calls it until `deleted` is 0; each call removes one batch so it stays within a
 * function's time limit. The inactivity check repeats right before the delete, in its transaction,
 * so a guest who comes back mid-run is kept with everything they had.
 */
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
