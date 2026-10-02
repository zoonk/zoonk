import "server-only";
import { prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getInstrumentWaitlistCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { toInstrumentWaitlistEntryView } from "./_utils/instrument-waitlist-entry-view";
import {
  type InstrumentWaitlistEntryView,
  type InstrumentWaitlistJoinInput,
} from "./instrument-waitlist-contract";

export type InstrumentWaitlistJoinResult =
  | { entry: InstrumentWaitlistEntryView; status: "joined" }
  | { status: "signInRequired" }
  | { status: "unauthorized" };

/**
 * Adds an instrument to the learner's waitlist for lessons that teach them to play it. Joining
 * twice keeps the first entry. Guests sign in first, since the waitlist exists to reach them when
 * those lessons are ready.
 */
export async function joinInstrumentWaitlist(
  input: InstrumentWaitlistJoinInput,
): Promise<InstrumentWaitlistJoinResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (session.user.isAnonymous) {
    return { status: "signInRequired" };
  }

  const userId = session.user.id;
  const normalizedInstrument = normalizeString(input.instrument);

  const entry = await prisma.instrumentWaitlistEntry.upsert({
    create: {
      instrument: input.instrument.trim(),
      language: input.language,
      normalizedInstrument,
      userId,
    },
    update: {},
    where: { userInstrument: { normalizedInstrument, userId } },
  });

  revalidateCacheTags([getInstrumentWaitlistCacheTag(userId)]);

  return { entry: toInstrumentWaitlistEntryView(entry), status: "joined" };
}
