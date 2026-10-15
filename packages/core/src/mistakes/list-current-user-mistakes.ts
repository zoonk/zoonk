import "server-only";
import { type Mistake, type MistakeCause, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { cacheTag } from "next/cache";
import { getLearnerModelCacheTag } from "../cache/tags";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { getOwnedGoal } from "../learner/get-owned-goal";
import { type TrueFalseLabels, getTrueFalseLabels } from "../library/exams/true-false-labels";
import { loadExamStructure } from "../sessions/_utils/exam-structure";
import { getSession } from "../users/get-session";
import { getScopeSkillIds } from "./_utils/mistake-scope";
import { type MistakeAvailability, type MistakeListInput } from "./contract";
import { loadMistakePracticeAvailability } from "./mistake-availability";
import { type MistakeLesson, findMistakeLessons } from "./mistake-lessons";
import { type MistakeSnapshot, readMistakeSnapshot } from "./mistake-snapshot";

type MistakeEntry = Pick<
  Mistake,
  "cause" | "createdAt" | "fixedAt" | "id" | "itemId" | "status"
> & {
  /** The lesson "Open the lesson" opens (see `findMistakeLessons`); null when there's none. */
  lesson: MistakeLesson | null;
  /** Open and made on an earlier local day; today's mistakes return tomorrow. */
  practiceAvailable: boolean;
  /** This open mistake has practice material and becomes available on the next local day. */
  practiceAvailableTomorrow: boolean;
  skill: { id: string; name: string } | null;
  snapshot: MistakeSnapshot;
};

/** Counts for the filters, over everything in scope before filtering by cause or status. */
type MistakeCounts = {
  byCause: Record<MistakeCause | "unsorted", number>;
  fixed: number;
  open: number;
};

export type CurrentUserMistakes =
  | {
      availability: MistakeAvailability;
      counts: MistakeCounts;
      hasMore: boolean;
      mistakes: MistakeEntry[];
      status: "ready";
      /** The words true-or-false statements are answered with: the goal's exam's, when scoped. */
      trueFalseLabels: TrueFalseLabels;
    }
  | { status: "notFound" }
  | { status: "unauthorized" };

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
 * readable after the question changes, and names the lesson to go back to.
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

  const owned = input.goalId ? await getOwnedGoal(input.goalId) : null;

  if (owned && owned.status !== "ready") {
    return owned;
  }

  const skillIds = await getScopeSkillIds(input);
  const scope = { userId, ...(skillIds ? { skillId: { in: skillIds } } : {}) };

  const timeZone = getAnswerTimeZone({
    goal: owned?.status === "ready" ? owned.goal : null,
    timeZone: input.timeZone,
  });

  const localDate = getDateInTimeZone({ date: new Date(), timeZone });

  const [rows, counts, structure, practiceAvailability] = await Promise.all([
    prisma.mistake.findMany({
      include: {
        skill: { select: { id: true, name: true } },
        step: { select: { lessonId: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: input.offset,
      take: input.limit + 1,
      where: { ...scope, cause: input.cause, status: input.status },
    }),
    countMistakes(scope),
    owned ? loadExamStructure(owned.goal) : null,
    loadMistakePracticeAvailability({
      goalId: input.goalId,
      localDate,
      skillIds,
      timeZone,
      userId,
    }),
  ]);

  const page = rows.slice(0, input.limit);
  const lessons = await findMistakeLessons({ mistakes: page, userId });

  return {
    availability: practiceAvailability.availability,
    counts,
    hasMore: rows.length > input.limit,
    mistakes: page.map((row) => ({
      cause: row.cause,
      createdAt: row.createdAt,
      fixedAt: row.fixedAt,
      id: row.id,
      itemId: row.itemId,
      lesson: lessons.get(row.id) ?? null,
      practiceAvailable: practiceAvailability.readyIds.has(row.id),
      practiceAvailableTomorrow: practiceAvailability.tomorrowIds.has(row.id),
      skill: row.skill,
      snapshot: readMistakeSnapshot(row.snapshot),
      status: row.status,
    })),
    status: "ready",
    trueFalseLabels: getTrueFalseLabels(structure),
  };
}
