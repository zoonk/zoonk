import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getInstrumentWaitlistCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";

export type InstrumentWaitlistLeaveResult =
  | { status: "left" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** Takes one instrument off the learner's waitlist. */
export async function leaveInstrumentWaitlist(
  entryId: string,
): Promise<InstrumentWaitlistLeaveResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!isUuid(entryId)) {
    return { status: "notFound" };
  }

  const userId = session.user.id;

  const { count } = await prisma.instrumentWaitlistEntry.deleteMany({
    where: { id: entryId, userId },
  });

  if (count === 0) {
    return { status: "notFound" };
  }

  revalidateCacheTags([getInstrumentWaitlistCacheTag(userId)]);

  return { status: "left" };
}
