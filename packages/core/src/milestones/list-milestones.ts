import "server-only";
import { type Milestone, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { isUuid } from "@zoonk/utils/uuid";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import { getSession } from "../users/get-session";
import { loadMilestoneCounts } from "./award-milestones";
import { type GlassesProgress, getGlassesProgress, pickCeremony } from "./milestone-rules";

/** A replay or another learner's id changes no ceremony. */
class MilestoneShownUnchangedError extends Error {
  override name = "MilestoneShownUnchangedError";
}

type MilestoneList = {
  /** The one milestone to celebrate next, if any hasn't been shown yet. */
  ceremony: Milestone | null;
  /** Every milestone earned, newest first: badges fill the logbook. */
  earned: Milestone[];
  /** Every pair of glasses with its progress, earned ones included. */
  glasses: GlassesProgress[];
};

export type MilestoneListResult =
  | { milestones: MilestoneList; status: "ready" }
  | { status: "unauthorized" };

/** The learner's milestones: glasses with their progress, badges, belts and buddy stages. */
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

/**
 * Records that a milestone was celebrated, so it's shown only once. Showing it again keeps the
 * first time.
 *
 * Tag invalidation from the acknowledgement's Server Action would re-render the page and remove
 * the ceremony while the learner is still viewing it.
 */
export async function markMilestoneShown(milestoneId: string): Promise<MilestoneShownResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!isUuid(milestoneId)) {
    return { status: "notFound" };
  }

  const userId = session.user.id;

  const { error } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      await markLearnerChanged(tx, { userId });

      const { count } = await tx.milestone.updateMany({
        data: { shownAt: new Date() },
        where: { id: milestoneId, shownAt: null, userId },
      });

      if (count === 0) {
        throw new MilestoneShownUnchangedError("The ceremony did not change");
      }
    }),
  );

  if (error && !(error instanceof MilestoneShownUnchangedError)) {
    throw error;
  }

  const milestone = await prisma.milestone.findFirst({ where: { id: milestoneId, userId } });

  return milestone ? { milestone, status: "ready" } : { status: "notFound" };
}
