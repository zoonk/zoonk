import "server-only";
import { type Mistake, type MistakeCause, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getLearnerModelCacheTag } from "../cache/tags";
import { loadGoalSkillIds } from "../learner/_utils/goal-skill-graph";
import { findOwnedGoal } from "../learner/_utils/owned-goal";
import { type TrueFalseLabels, getTrueFalseLabels } from "../library/exams/true-false-labels";
import { loadExamStructure } from "../sessions/_utils/load-build-inputs";
import { getSession } from "../users/get-session";
import { type MistakeListInput } from "./contract";
import { type MistakeSnapshot, readMistakeSnapshot } from "./mistake-snapshot";

type MistakeEntry = Pick<
  Mistake,
  "cause" | "createdAt" | "fixedAt" | "id" | "itemId" | "status"
> & { skill: { id: string; name: string } | null; snapshot: MistakeSnapshot };

/** Counts for the filters, over everything in scope before filtering by cause or status. */
type MistakeCounts = {
  byCause: Record<MistakeCause | "unsorted", number>;
  fixed: number;
  open: number;
};

export type CurrentUserMistakes =
  | {
      counts: MistakeCounts;
      hasMore: boolean;
      mistakes: MistakeEntry[];
      status: "ready";
      /** The words true-or-false statements are answered with: the goal's exam's, when scoped. */
      trueFalseLabels: TrueFalseLabels;
    }
  | { status: "notFound" }
  | { status: "unauthorized" };

async function getScopeSkillIds(input: MistakeListInput): Promise<string[] | null> {
  if (input.skillId) {
    return [input.skillId];
  }

  return input.goalId ? loadGoalSkillIds(input.goalId) : null;
}

async function countMistakes(where: {
  skillId?: { in: string[] };
  userId: string;
}): Promise<MistakeCounts> {
  const groups = await prisma.mistake.groupBy({
    _count: { id: true },
    by: ["cause", "status"],
    where,
  });

  const sum = (match: (group: (typeof groups)[number]) => boolean) =>
    groups.filter((group) => match(group)).reduce((total, group) => total + group._count.id, 0);

  return {
    byCause: {
      gap: sum((group) => group.cause === "gap"),
      guess: sum((group) => group.cause === "guess"),
      misread: sum((group) => group.cause === "misread"),
      time: sum((group) => group.cause === "time"),
      trap: sum((group) => group.cause === "trap"),
      unsorted: sum((group) => group.cause === null),
    },
    fixed: sum((group) => group.status === "fixed"),
    open: sum((group) => group.status === "open"),
  };
}

/**
 * Lists the learner's mistakes notebook, newest first, filterable by goal (subject), skill, cause
 * and status, with counts for the filter chips. Each entry keeps its own snapshot, so it stays
 * readable after the question changes.
 */
export async function listCurrentUserMistakes(
  input: MistakeListInput,
): Promise<CurrentUserMistakes> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  cacheTag(getLearnerModelCacheTag(userId));

  const owned = input.goalId ? await findOwnedGoal(input.goalId) : null;

  if (owned && owned.status !== "ready") {
    return owned;
  }

  const skillIds = await getScopeSkillIds(input);
  const scope = { userId, ...(skillIds ? { skillId: { in: skillIds } } : {}) };

  const [rows, counts, structure] = await Promise.all([
    prisma.mistake.findMany({
      include: { skill: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: input.offset,
      take: input.limit + 1,
      where: { ...scope, cause: input.cause, status: input.status },
    }),
    countMistakes(scope),
    owned ? loadExamStructure(owned.goal) : null,
  ]);

  return {
    counts,
    hasMore: rows.length > input.limit,
    mistakes: rows
      .slice(0, input.limit)
      .map((row) => ({
        cause: row.cause,
        createdAt: row.createdAt,
        fixedAt: row.fixedAt,
        id: row.id,
        itemId: row.itemId,
        skill: row.skill,
        snapshot: readMistakeSnapshot(row.snapshot),
        status: row.status,
      })),
    status: "ready",
    trueFalseLabels: getTrueFalseLabels(structure),
  };
}
