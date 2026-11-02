import "server-only";
import { type Milestone, prisma } from "@zoonk/db";
import { pickCeremony } from "./milestone-rules";

/** Returns the highest-priority unshown milestone, or null. */
export async function loadCeremony(userId: string): Promise<Milestone | null> {
  const unshown = await prisma.milestone.findMany({ where: { shownAt: null, userId } });
  return pickCeremony(unshown);
}
