import "server-only";
import { type Milestone, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import { getSession } from "../users/get-session";
import { loadMilestoneCounts } from "./award-milestones";
import { type GlassesProgress, getGlassesProgress, pickCeremony } from "./milestone-rules";

type MilestoneList = {
  /** The next unshown milestone, if any. */
  ceremony: Milestone | null;
  /** Newest first. */
  earned: Milestone[];
  /** Includes already-earned glasses. */
  glasses: GlassesProgress[];
};

export type MilestoneListResult =
  | { milestones: MilestoneList; status: "ready" }
  | { status: "unauthorized" };

export async function listCurrentUserMilestones(): Promise<MilestoneListResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  const [earned, counts] = await Promise.all([
    prisma.milestone.findMany({ orderBy: { earnedAt: "desc" }, where: { userId } }),
    loadMilestoneCounts(userId),
  ]);

  return {
    milestones: { ceremony: pickCeremony(earned), earned, glasses: getGlassesProgress(counts) },
    status: "ready",
  };
}

export type MilestoneShownResult =
  | { milestone: Milestone; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** Replays preserve the first shown time. Do not invalidate from this Server Action: rerendering would dismiss the active ceremony. */
export async function markMilestoneShown(milestoneId: string): Promise<MilestoneShownResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!isUuid(milestoneId)) {
    return { status: "notFound" };
  }

  const userId = session.user.id;

  await prisma.$transaction(async (tx) => {
    await markLearnerChanged(tx, { userId });

    await tx.milestone.updateMany({
      data: { shownAt: new Date() },
      where: { id: milestoneId, shownAt: null, userId },
    });
  });

  const milestone = await prisma.milestone.findFirst({ where: { id: milestoneId, userId } });

  return milestone ? { milestone, status: "ready" } : { status: "notFound" };
}
