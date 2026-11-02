import "server-only";
import { type SourceChangeNotice, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { isUuid } from "@zoonk/utils/uuid";
import { getRequestInstant } from "../../learner/facts/request-instant";
import { parsePlanChangePayload } from "../../plans/_utils/plan-change-payload";
import { NOTICE_SOURCE } from "../../plans/plan-change-contract";
import { getSession } from "../../users/get-session";
import { type LibraryProvenance, toProvenanceData } from "../_utils/library-rows";
import { createSourceChangeNotice } from "./content-review-flags";

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

/** For source changes; record exam notices through `saveExamBlueprint` so the notice and blueprint commit together. */
export function recordSourceChangeNotice(input: SourceNoticeInput): Promise<SourceChangeNotice> {
  const { provenance, ...notice } = input;

  return prisma.$transaction((tx) =>
    createSourceChangeNotice({
      data: { ...notice, examBlueprintId: null, ...toProvenanceData(provenance) },
      tx,
    }),
  );
}

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

  const now = await getRequestInstant();
  const since = getNewsStart({ goal, now: now.getTime() });

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
