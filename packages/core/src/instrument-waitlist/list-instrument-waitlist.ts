import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getInstrumentWaitlistCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { toInstrumentWaitlistEntryView } from "./_utils/instrument-waitlist-entry-view";
import { type InstrumentWaitlistEntryView } from "./instrument-waitlist-contract";

/** The instruments the learner is waiting to learn to play, oldest first. Null without a session. */
export async function listInstrumentWaitlist(): Promise<InstrumentWaitlistEntryView[] | null> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return null;
  }

  cacheTag(getInstrumentWaitlistCacheTag(session.user.id));

  const entries = await prisma.instrumentWaitlistEntry.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    where: { userId: session.user.id },
  });

  return entries.map((entry) => toInstrumentWaitlistEntryView(entry));
}
