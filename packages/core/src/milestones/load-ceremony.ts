import "server-only";
import { type Milestone, prisma } from "@zoonk/db";
import { loadUnshownCertificates } from "../certificates/_utils/unshown-certificates";
import { type CertificateFacts } from "../certificates/certificate-contract";
import { type MilestoneView, serializeMilestone } from "../sessions/completion-contract";
import { pickCeremony } from "./milestone-rules";

/** Returns the highest-priority unshown milestone, or null. */
export async function loadCeremony(userId: string): Promise<Milestone | null> {
  const unshown = await prisma.milestone.findMany({ where: { shownAt: null, userId } });
  return pickCeremony(unshown);
}

export type ResultMoments = { ceremony: MilestoneView | null; certificates: CertificateFacts[] };

export const NO_RESULT_MOMENTS: ResultMoments = { ceremony: null, certificates: [] };

/** What a result shows before itself: the unshown certificates, then the one milestone. */
export async function loadResultMoments(userId: string): Promise<ResultMoments> {
  const [ceremony, certificates] = await Promise.all([
    loadCeremony(userId),
    loadUnshownCertificates(userId),
  ]);

  return { ceremony: ceremony ? serializeMilestone(ceremony) : null, certificates };
}
