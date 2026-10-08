import "server-only";
import { type SourceChangeNotice, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { isUuid } from "@zoonk/utils/uuid";
import { parsePlanChangePayload } from "../../plans/_utils/plan-change-payload";
import { NOTICE_SOURCE } from "../../plans/plan-change-contract";
import { getSession } from "../../users/get-session";
import { type LibraryProvenance, toProvenanceData } from "../_utils/library-rows";
import { createSourceChangeNotice } from "./content-review-flags";

/** A notice is news for two weeks; after that the plan already reflects it. */
const NOTICE_DAYS = 14;
const MAX_GOAL_NOTICES = 3;

export type SourceNoticeInput = {
  contentHash: string;
  fields: string[];
  language: string;
  message: string;
  previousHash: string;
  provenance: LibraryProvenance;
  sourceId: string;
};

/**
 * Records the one line learners see after a source they study changed, such
 * as a law or a tool's documentation, and flags the lessons and questions
 * built on it for a rewrite. Exam notices are recorded with their blueprint
 * update instead, in the same transaction.
 */
export function recordSourceChangeNotice(input: SourceNoticeInput): Promise<SourceChangeNotice> {
  const { provenance, ...notice } = input;

  return prisma.$transaction((tx) =>
    createSourceChangeNotice({
      data: { ...notice, examBlueprintId: null, ...toProvenanceData(provenance) },
      tx,
    }),
  );
}

/**
 * The notices a change to the goal's plan already says, with its Apply and "Keep mine" (a new
 * exam date, say), so Today never shows the same news twice.
 */
async function listNoticesInPlanChanges(goalId: string): Promise<Set<string>> {
  const changes = await prisma.planChange.findMany({
    select: { payload: true },
    where: { payload: { equals: NOTICE_SOURCE, path: ["source"] }, plan: { goalId } },
  });

  return new Set(
    changes.flatMap((change) => parsePlanChangePayload(change.payload).noticeId ?? []),
  );
}

export type GoalChangeNoticesResult =
  | { notices: SourceChangeNotice[]; status: "ready" }
  | { status: "notFound" | "unauthorized" };

/**
 * When the goal's news starts: after it started and, for an exam plan that waited for research to
 * read its notice, after that wait ended, since a reading before then shaped the plan the learner
 * saw (or the change Today offers for it). Older than two weeks is no longer news.
 */
function getNewsStart({
  goal,
  now,
}: {
  goal: { createdAt: Date; plan: { noticeWaitEndedAt: Date | null } | null };
  now: number;
}): Date {
  const waitEnded = goal.plan?.noticeWaitEndedAt?.getTime() ?? 0;
  return new Date(Math.max(goal.createdAt.getTime(), waitEnded, now - NOTICE_DAYS * MS_PER_DAY));
}

/**
 * The recent change notices for one of the learner's goals, newest first, for
 * the line on Today: changes to its exam's blueprint and to the sources linked
 * to it, made after the goal's plan was built (see `getNewsStart`). Another learner's goal is not
 * found. Private cached, so Today prefetches with it.
 */
export async function listGoalChangeNotices({
  goalId,
}: {
  goalId: string;
}): Promise<GoalChangeNoticesResult> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const goal = isUuid(goalId)
    ? await prisma.goal.findFirst({
        select: {
          createdAt: true,
          examBlueprintId: true,
          id: true,
          plan: { select: { noticeWaitEndedAt: true } },
        },
        where: { id: goalId, userId: session.user.id },
      })
    : null;

  if (!goal) {
    return { status: "notFound" };
  }

  const since = getNewsStart({ goal, now: Date.now() });

  const [notices, answered] = await Promise.all([
    prisma.sourceChangeNotice.findMany({
      orderBy: { createdAt: "desc" },
      take: MAX_GOAL_NOTICES,
      where: {
        OR: [
          ...(goal.examBlueprintId ? [{ examBlueprintId: goal.examBlueprintId }] : []),
          { examBlueprintId: null, source: { learnerSources: { some: { goalId: goal.id } } } },
        ],
        createdAt: { gte: since },
      },
    }),
    listNoticesInPlanChanges(goal.id),
  ]);

  return { notices: notices.filter((notice) => !answered.has(notice.id)), status: "ready" };
}
