import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { loadDatedClaims } from "../../learner/_utils/load-skill-claims";
import { loadExamFacts } from "../../plans/_utils/planner-exam-facts";
import { findAnnouncedSkillIds } from "../../plans/planner/announced-lessons";
import { type PlanGraph } from "../../plans/planner/plan-state";
import { findFrequentSkillIds } from "../../plans/planner/topic-weights";
import { readBlockPayload } from "../block-payload";
import { loadReviewCapsules } from "./load-review-capsules";

/**
 * The skills the learner was taken to know (one right test answer, a test-out) that practice still
 * has to confirm. `first`: topics the exam asks most or the class test announces, and any that
 * waited about a week (`DUE_AFTER_DAYS`), which always get their question. `last`: the others, as
 * time allows. Each in turn by when a session last asked it (`lastAsked`, see `loadLastAsked`).
 */
export type PracticeClaims = {
  first: ReadonlySet<string>;
  last: ReadonlySet<string>;
  /** When an earlier day's session last asked each skill, as a timestamp; never asked, absent. */
  lastAsked: ReadonlyMap<string, number>;
};

/**
 * A topic taken as known joins practice about a week after: from then on it's asked first, so it
 * gets a question within its first two weeks however little the exam asks it.
 */
const DUE_AFTER_DAYS = 7;
const DAY_MS = 86_400_000;

/** How far back sessions count as having asked a topic: the two weeks it has to come up in. */
const ASKED_WINDOW_DAYS = 14;

export const NO_PRACTICE_CLAIMS: PracticeClaims = {
  first: new Set(),
  last: new Set(),
  lastAsked: new Map(),
};

/**
 * When the goal's sessions of the last two weeks before today last asked each skill, in practice
 * or a review. Topics to confirm take turns by it: a learner who skips practice would otherwise get
 * the same ones every day while the rest wait. Today's own session doesn't count, so building it
 * again the same day asks the same ones.
 */
async function loadLastAsked({
  goalId,
  today,
}: {
  goalId: string;
  today: Date;
}): Promise<Map<string, number>> {
  const blocks = await prisma.studySessionBlock.findMany({
    select: { id: true, payload: true, session: { select: { localDate: true } } },
    where: {
      kind: { in: ["practice", "review"] },
      session: {
        goalId,
        localDate: { gte: new Date(today.getTime() - ASKED_WINDOW_DAYS * DAY_MS), lt: today },
      },
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

/**
 * What a goal's practice confirms (see `PracticeClaims`). One right answer frees a topic from its
 * lessons, never from practice: Pedro answered "Organelles", which his teacher said comes up a lot,
 * right once, and his plan never asked it again before the test.
 */
export async function loadPracticeClaims({
  goal,
  graph,
  now,
  skillIds,
  today,
  userId,
}: {
  goal: Pick<Goal, "examBlueprintId" | "id" | "kind">;
  graph: PlanGraph;
  now: Date;
  /** The goal's skills practice may ask: the ones its plan or its test has. */
  skillIds: readonly string[];
  /** The learner-local date of the session, as a UTC-midnight label. */
  today: Date;
  userId: string;
}): Promise<PracticeClaims> {
  const claims = await loadDatedClaims({ goalId: goal.id, skillIds, userId });
  const dueBefore = now.getTime() - DUE_AFTER_DAYS * DAY_MS;

  const toConfirm = [...claims].filter(([, { claim }]) => claim === "toConfirm");

  if (toConfirm.length === 0) {
    return NO_PRACTICE_CLAIMS;
  }

  const [facts, lastAsked] = await Promise.all([
    loadExamFacts({ goal, graph }),
    loadLastAsked({ goalId: goal.id, today }),
  ]);

  const priority = new Set([
    ...findFrequentSkillIds({ graph, levels: facts.topicLevels }),
    ...findAnnouncedSkillIds({ announcements: facts.announcements, skills: graph.skills }),
    ...toConfirm.flatMap(([skillId, { since }]) => (since.getTime() <= dueBefore ? [skillId] : [])),
  ]);

  const toConfirmIds = toConfirm
    .map(([skillId]) => skillId)
    .toSorted((a, b) => (lastAsked.get(a) ?? 0) - (lastAsked.get(b) ?? 0));

  return {
    first: new Set(toConfirmIds.filter((skillId) => priority.has(skillId))),
    last: new Set(toConfirmIds.filter((skillId) => !priority.has(skillId))),
    lastAsked,
  };
}

/**
 * Today's capsules (see `loadReviewCapsules`) and what practice confirms (see
 * `loadPracticeClaims`). A free exam plan past its first week has no practice (it's Plus), so its
 * quick review asks the known topics due first, within its usual size: on a free OAB plan, a topic
 * placement took as known came up nowhere for two weeks.
 */
export async function loadReviewsAndClaims({
  claims: claimsInput,
  practiceLocked,
  review,
}: {
  claims: Parameters<typeof loadPracticeClaims>[0];
  /** The day's session has no practice (see `ExamPrepAccess.trialEnded`). */
  practiceLocked: boolean;
  review: Parameters<typeof loadReviewCapsules>[0];
}) {
  if (!practiceLocked) {
    const [capsules, claims] = await Promise.all([
      loadReviewCapsules(review),
      loadPracticeClaims(claimsInput),
    ]);

    return { capsules, claims };
  }

  const claims = await loadPracticeClaims(claimsInput);
  const capsules = await loadReviewCapsules({ ...review, confirmSkillIds: [...claims.first] });

  return { capsules, claims };
}
