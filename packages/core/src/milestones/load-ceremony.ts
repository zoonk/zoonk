import "server-only";
import { type Milestone, prisma } from "@zoonk/db";
import { pickCeremony } from "./milestone-rules";

/**
 * The one ceremony a result may show (a session's summary, a mock's result): the most important
 * milestone the learner hasn't been shown yet, wherever they earned it.
 */
export async function loadCeremony(userId: string): Promise<Milestone | null> {
  const unshown = await prisma.milestone.findMany({ where: { shownAt: null, userId } });
  return pickCeremony(unshown);
}
