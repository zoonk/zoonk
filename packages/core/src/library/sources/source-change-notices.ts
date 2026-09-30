import "server-only";
import { type SourceChangeNotice, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { isUuid } from "@zoonk/utils/uuid";
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

export type GoalChangeNoticesResult =
  | { notices: SourceChangeNotice[]; status: "ready" }
  | { status: "notFound" | "unauthorized" };

/**
 * The recent change notices for one of the learner's goals, newest first, for
 * the line on Today: changes to its exam's blueprint and to the sources linked
 * to it, made after the goal started. Another learner's goal is not found.
 */
export async function listGoalChangeNotices({
  goalId,
}: {
  goalId: string;
}): Promise<GoalChangeNoticesResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const goal = isUuid(goalId)
    ? await prisma.goal.findFirst({
        select: { createdAt: true, examBlueprintId: true, id: true },
        where: { id: goalId, userId: session.user.id },
      })
    : null;

  if (!goal) {
    return { status: "notFound" };
  }

  const since = new Date(Math.max(goal.createdAt.getTime(), Date.now() - NOTICE_DAYS * MS_PER_DAY));

  const notices = await prisma.sourceChangeNotice.findMany({
    orderBy: { createdAt: "desc" },
    take: MAX_GOAL_NOTICES,
    where: {
      OR: [
        ...(goal.examBlueprintId ? [{ examBlueprintId: goal.examBlueprintId }] : []),
        { examBlueprintId: null, source: { learnerSources: { some: { goalId: goal.id } } } },
      ],
      createdAt: { gte: since },
    },
  });

  return { notices, status: "ready" };
}
