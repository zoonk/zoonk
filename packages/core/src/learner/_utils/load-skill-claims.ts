import "server-only";
import { type Plan, type PlanItem, prisma } from "@zoonk/db";
import { getLessonSkillRows, toIdKey } from "../../library/_utils/shared-rows";
import { loadPassedOverClaims } from "../../plans/_utils/load-passed-over-claims";
import { loadUndoneTestOuts } from "../../plans/_utils/undone-test-outs";
import { listFocusedSkillIds } from "../../plans/planner/focus-targets";
import { parsePlanGraph, parsePlanSettings } from "../../plans/planner/plan-state";
import {
  type ClaimEvent,
  type DatedClaim,
  type SkillClaim,
  listAnsweredWrong,
  listClaimed,
  listKnownSkills,
  listTakenToKnow,
  readDatedClaims,
  readSkillClaims,
} from "./skill-claims";

/** More answers than this on one goal's skills say nothing new about what's still to confirm. */
const MAX_ANSWERS = 2000;

/**
 * The saved plan a GET already read (`readSavedPlan`), so its claims don't read it again; writes
 * leave it out and read their own.
 */
export type ClaimPlan = Pick<Plan, "createdAt" | "graph" | "id" | "settings"> & {
  items: Pick<PlanItem, "completedAt" | "kind" | "lessonId" | "skillId" | "status">[];
};

/** A plan's finished lessons and chapters, which claim their skills. */
function isClaimingItem(item: ClaimPlan["items"][number]) {
  return (
    item.completedAt !== null &&
    (item.kind === "chapter" || item.kind === "lesson") &&
    (item.status === "done" || item.status === "testedOut")
  );
}

/**
 * The skills these finished lessons teach. A GET (which passes its saved plan) reads the shared
 * rows of every lesson in the plan, the entry its other reads share, and keeps these.
 */
async function loadClaimLessonSkills({
  known,
  lessonIds,
}: {
  known?: ClaimPlan | null;
  lessonIds: readonly string[];
}) {
  if (known) {
    const wanted = new Set(lessonIds);
    const rows = await getLessonSkillRows(toIdKey(known.items.map((item) => item.lessonId)));
    return rows.filter((row) => wanted.has(row.lessonId));
  }

  return lessonIds.length > 0
    ? prisma.lessonSkill.findMany({
        select: { lessonId: true, skillId: true },
        where: { lessonId: { in: [...lessonIds] } },
      })
    : [];
}

/**
 * A goal's test-outs as claims on the skills they skipped, and its finished lessons as skills
 * studied: a stand-in's skill, or every skill its lesson teaches. A test-out claims the skill its
 * item counts for, which the learner showed they know (see `markPlanItemsTestedOut`), never one
 * the Library links to its lesson later: a portfolio case study outlined with the lessons of a
 * journey map the learner had tested out of read as known, though they never answered on it
 * (career seed 2042). An item whose skill left the plan's graph (merged since) claims every skill
 * its lesson teaches.
 */
async function loadPlanEvents({
  goalId,
  known,
  skillIds,
}: {
  goalId: string;
  known?: ClaimPlan | null;
  skillIds: ReadonlySet<string>;
}): Promise<ClaimEvent[]> {
  const [items, plan] =
    known === undefined
      ? await Promise.all([
          prisma.planItem.findMany({
            select: { completedAt: true, lessonId: true, skillId: true, status: true },
            where: {
              completedAt: { not: null },
              kind: { in: ["chapter", "lesson"] },
              plan: { goalId },
              status: { in: ["done", "testedOut"] },
            },
          }),
          prisma.plan.findUnique({ select: { graph: true }, where: { goalId } }),
        ])
      : [known?.items.filter((item) => isClaimingItem(item)) ?? [], known];

  const graphSkills = new Set(parsePlanGraph(plan?.graph).skills.map((skill) => skill.skillId));

  const lessonIds = items.flatMap((item) => item.lessonId ?? []);
  const lessonSkills = await loadClaimLessonSkills({ known, lessonIds });

  const taughtBy = Map.groupBy(lessonSkills, (row) => row.lessonId);

  return items.flatMap((item) => {
    const taught = item.lessonId
      ? (taughtBy.get(item.lessonId) ?? []).map((row) => row.skillId)
      : [];

    const claimed =
      item.status === "testedOut" && item.skillId && graphSkills.has(item.skillId)
        ? [item.skillId]
        : [...new Set([...(item.skillId ? [item.skillId] : []), ...taught])];

    return claimed
      .filter((skillId) => skillIds.has(skillId))
      .map((skillId): ClaimEvent => ({
        at: item.completedAt ?? new Date(0),
        kind: item.status === "done" ? "studied" : "claim",
        skillId,
      }));
  });
}

/**
 * The learner's answers to the bank's questions on these skills (lesson steps aren't any): a
 * session's are practice (its reviews, mixed practice, full review and mock), the others a test's
 * (placement, the focus test, a chapter test, a mock taken any time). A placement question a
 * first-week session asks is still a test's.
 */
async function loadAnswerEvents({
  skillIds,
  userId,
}: {
  skillIds: readonly string[];
  userId: string;
}): Promise<ClaimEvent[]> {
  const answers = await prisma.attempt.findMany({
    orderBy: { answeredAt: "desc" },
    select: {
      answeredAt: true,
      isCorrect: true,
      isPlacement: true,
      item: { select: { format: true } },
      skillId: true,
      studySessionId: true,
    },
    take: MAX_ANSWERS,
    where: { itemId: { not: null }, skillId: { in: [...skillIds] }, stepId: null, userId },
  });

  return answers.flatMap((answer): ClaimEvent[] =>
    answer.skillId
      ? [
          {
            at: answer.answeredAt,
            isCorrect: answer.isCorrect,
            kind: answer.studySessionId && !answer.isPlacement ? "practice" : "test",
            skillId: answer.skillId,
            trueFalse: answer.item?.format === "trueFalse",
          },
        ]
      : [],
  );
}

/**
 * Each claim on a goal's skills with the day it began (see `loadSkillClaims`): practice asks a
 * topic still to confirm first once it has waited about a week. The basics the learner passed
 * over by choice are claims too, from the day of the choice (see `loadPassedOverClaims`).
 */
export async function loadDatedClaims({
  goalId,
  skillIds,
  userId,
}: {
  goalId: string;
  skillIds: readonly string[];
  userId: string;
}): Promise<Map<string, DatedClaim>> {
  if (skillIds.length === 0) {
    return new Map();
  }

  return readDatedClaims(await loadClaimEvents({ goalId, skillIds, userId }));
}

/** Everything the learner model reads of a goal's skills (see `loadDatedClaims`). */
export async function loadClaimEvents({
  goalId,
  plan,
  skillIds,
  userId,
}: {
  goalId: string;
  plan?: ClaimPlan | null;
  skillIds: readonly string[];
  userId: string;
}): Promise<ClaimEvent[]> {
  const [planEvents, passedOver, undone, answers] = await Promise.all([
    loadPlanEvents({ goalId, known: plan, skillIds: new Set(skillIds) }),
    loadPassedOverClaims({ goalId, known: plan, skillIds: new Set(skillIds) }),
    loadUndoneTestOuts({ goalId, skillIds: new Set(skillIds) }),
    loadAnswerEvents({ skillIds, userId }),
  ]);

  return [...planEvents, ...passedOver, ...undone, ...answers];
}

/**
 * What a plan reads of the learner model: each skill's claim (see `loadSkillClaims`), the skills
 * an answer missed, even ones a later answer claimed again (see `listAnsweredWrong`), and the ones
 * the learner showed they know (see `listKnownSkills`), which the syllabus says are known.
 */
export async function loadSkillEvidence({
  focused,
  passedOver,
  ...input
}: {
  /** The skills the learner focused on: their own answers take them as known twice. */
  focused?: (skillId: string) => boolean;
  goalId: string;
  /** The basics the learner passed over by choice, still to confirm (see `listKnownSkills`). */
  passedOver?: (skillId: string) => boolean;
  skillIds: readonly string[];
  userId: string;
}): Promise<{ answeredWrong: Set<string>; claims: Map<string, SkillClaim>; known: Set<string> }> {
  if (input.skillIds.length === 0) {
    return { answeredWrong: new Set(), claims: new Map(), known: new Set() };
  }

  const events = await loadClaimEvents(input);

  return {
    answeredWrong: listAnsweredWrong(events),
    claims: readSkillClaims(events),
    known: listKnownSkills({ events, focused, passedOver }),
  };
}

/**
 * What a plan reads of one skill (see `loadSkillEvidence`, `loadPlannerInputs`), before the answer
 * given at `answeredAt` and with it: whether the learner showed they know it (two right answers of
 * its own when they focused on it), whether it's a gap, and whether an answer missed it. Two equal
 * readings plan alike.
 */
export async function loadAnswerPlanReadings({
  answeredAt,
  goalId,
  skillId,
  userId,
}: {
  answeredAt: Date;
  goalId: string;
  skillId: string;
  userId: string;
}): Promise<{ after: string; before: string }> {
  const [events, plan] = await Promise.all([
    loadClaimEvents({ goalId, skillIds: [skillId], userId }),
    prisma.plan.findUnique({ select: { graph: true, settings: true }, where: { goalId } }),
  ]);

  const focused = listFocusedSkillIds({
    graph: parsePlanGraph(plan?.graph),
    settings: parsePlanSettings(plan?.settings),
  }).has(skillId);

  const read = (list: readonly ClaimEvent[]) =>
    [
      listKnownSkills({ events: list, focused: () => focused }).has(skillId),
      readSkillClaims(list).get(skillId) === "gap",
      listAnsweredWrong(list).has(skillId),
    ].join("|");

  return { after: read(events), before: read(events.filter((event) => event.at < answeredAt)) };
}

/**
 * What a goal's skills the learner was taken to know still need (see `SkillClaim`): from its
 * test-outs, the lessons finished and the learner's answers on them. Skills nothing claimed are
 * absent.
 */
async function loadSkillClaims(input: {
  goalId: string;
  skillIds: readonly string[];
  userId: string;
}): Promise<Map<string, SkillClaim>> {
  const dated = await loadDatedClaims(input);
  return new Map([...dated].map(([skillId, { claim }]) => [skillId, claim]));
}

/**
 * Which of these skills the learner was taken to know without studying them (see
 * `listTakenToKnow`): a miss on one brings its lessons back (`bringBackMissedLessons`).
 */
export async function loadSkillsToRelearn(input: {
  goalId: string;
  skillIds: readonly string[];
  userId: string;
}): Promise<Set<string>> {
  if (input.skillIds.length === 0) {
    return new Set();
  }

  return listTakenToKnow(await loadClaimEvents(input));
}

/** Which of these skills the learner was taken to know and practice hasn't confirmed yet. */
export async function loadSkillsToConfirm(input: {
  goalId: string;
  skillIds: readonly string[];
  userId: string;
}): Promise<Set<string>> {
  return listClaimed({ claim: "toConfirm", claims: await loadSkillClaims(input) });
}
