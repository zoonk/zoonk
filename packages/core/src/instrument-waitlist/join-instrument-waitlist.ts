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

/** Requires a non-guest session; duplicate joins preserve the first entry. */
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
