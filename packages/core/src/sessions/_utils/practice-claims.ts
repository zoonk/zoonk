import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { loadDatedClaims } from "../../learner/_utils/load-skill-claims";
import { type ClaimEvent } from "../../learner/_utils/skill-claims";
import { loadCourseStarts, priorityCourseStarts } from "../../plans/_utils/course-starts";
import { loadExamFacts } from "../../plans/_utils/planner-exam-facts";
import { findAnnouncedSkillIds } from "../../plans/planner/announced-lessons";
import { type PlanGraph } from "../../plans/planner/plan-state";
import { findFrequentSkillIds } from "../../plans/planner/topic-weights";
import { readBlockPayload } from "../block-payload";

/** first must receive questions even on short days; last is optional. Rotate claims by lastAsked rather than studying order. */
export type PracticeClaims = {
  first: ReadonlySet<string>;
  prerequisites?: ReadonlySet<string>;
  courseStarts?: readonly string[];
  last: ReadonlySet<string>;
  /** When an earlier day's session last asked each skill, as a timestamp; never asked, absent. */
  lastAsked: ReadonlyMap<string, number>;
};

/** Promote aging unconfirmed claims so low-weight topics cannot wait indefinitely. */
const DUE_AFTER_DAYS = 7;

const ASKED_WINDOW_DAYS = 14;

export const NO_PRACTICE_CLAIMS: PracticeClaims = {
  first: new Set(),
  last: new Set(),
  lastAsked: new Map(),
};

/** Exclude today's own session so rebuilding today cannot rotate a different question into its queue. */
async function loadLastAsked({
  goalId,
  starts,
  today,
}: {
  goalId: string;
  starts: ReadonlyMap<string, { at: Date }>;
  today: Date;
}): Promise<Map<string, number>> {
  const since = Math.min(
    today.getTime() - ASKED_WINDOW_DAYS * MS_PER_DAY,
    ...[...starts.values()].map((start) => start.at.getTime() - MS_PER_DAY),
  );

  const blocks = await prisma.studySessionBlock.findMany({
    select: { id: true, payload: true, session: { select: { localDate: true } } },
    where: {
      kind: { in: ["practice", "review"] },
      session: { goalId, localDate: { gte: new Date(since), lt: today } },
    },
  });

  const asked = blocks
    .flatMap((block) =>
      readBlockPayload(block).skillIds.map(
        (skillId) => [skillId, block.session.localDate] as const,
      ),
    )
    .toSorted(([, a], [, b]) => a.getTime() - b.getTime());

  return new Map(asked.map(([skillId, day]) => [skillId, day.getTime()]));
}

/** A skipped lesson never removes the obligation to confirm its skill in practice. */
export async function loadPracticeClaims({
  goal,
  graph,
  now,
  readClaims,
  skillIds,
  today,
  userId,
}: {
  goal: Pick<Goal, "examBlueprintId" | "id" | "kind">;
  graph: PlanGraph;
  now: Date;
  readClaims?: (skillIds: readonly string[]) => Promise<ClaimEvent[]>;
  /** The goal's skills practice may ask: the ones its plan or its test has. */
  skillIds: readonly string[];
  /** The learner-local date of the session, as a UTC-midnight label. */
  today: Date;
  userId: string;
}): Promise<PracticeClaims> {
  const claims = await loadDatedClaims({ goalId: goal.id, readClaims, skillIds, userId });
  const dueBefore = now.getTime() - DUE_AFTER_DAYS * MS_PER_DAY;

  const toConfirm = [...claims].filter(([, { claim }]) => claim === "toConfirm");

  if (toConfirm.length === 0) {
    return NO_PRACTICE_CLAIMS;
  }

  const [facts, starts] = await Promise.all([
    loadExamFacts({ goal, graph }),
    goal.kind === "learn"
      ? loadCourseStarts(goal.id)
      : new Map<string, { at: Date; changeId: string }>(),
  ]);

  const pending = new Map(
    toConfirm.flatMap(([id]) => {
      const start = starts.get(id);
      return start ? [[id, start] as const] : [];
    }),
  );

  const [lastAsked, prerequisites] = await Promise.all([
    loadLastAsked({ goalId: goal.id, starts: pending, today }),
    priorityCourseStarts(goal.id, pending),
  ]);

  const needed = new Set(prerequisites);

  const askedSinceStart = (id: string) =>
    (lastAsked.get(id) ?? 0) >= (starts.get(id)?.at.getTime() ?? 0) - MS_PER_DAY;

  const priority = new Set([
    ...needed,
    ...findFrequentSkillIds({ graph, levels: facts.topicLevels }),
    ...findAnnouncedSkillIds({ announcements: facts.announcements, skills: graph.skills }),
    ...toConfirm.flatMap(([skillId, { since }]) => (since.getTime() <= dueBefore ? [skillId] : [])),
  ]);

  const toConfirmIds = toConfirm
    .map(([skillId]) => skillId)
    .toSorted((a, b) => (lastAsked.get(a) ?? 0) - (lastAsked.get(b) ?? 0));

  return {
    courseStarts: toConfirmIds
      .filter((id) => starts.has(id))
      .toSorted(
        (a, b) =>
          Number(askedSinceStart(a)) - Number(askedSinceStart(b)) ||
          Number(needed.has(b)) - Number(needed.has(a)),
      ),
    first: new Set(toConfirmIds.filter((skillId) => priority.has(skillId))),
    last: new Set(toConfirmIds.filter((skillId) => !priority.has(skillId))),
    lastAsked,
    prerequisites: needed,
  };
}
