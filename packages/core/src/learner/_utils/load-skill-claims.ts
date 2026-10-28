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

const MAX_ANSWERS = 2000;

/** GETs pass the saved plan already read; writes omit it for a fresh read. */
export type ClaimPlan = Pick<Plan, "createdAt" | "graph" | "id" | "settings"> & {
  items: Pick<PlanItem, "completedAt" | "kind" | "lessonId" | "skillId" | "status">[];
};

function isClaimingItem(item: ClaimPlan["items"][number]) {
  return (
    item.completedAt !== null &&
    (item.kind === "chapter" || item.kind === "lesson") &&
    (item.status === "done" || item.status === "testedOut")
  );
}

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

/** A test-out claims the skill tested, never skills later linked to its lesson. */
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

/** Includes basics skipped by choice, dated from that choice. */
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

/** Compares evidence immediately before answeredAt with evidence including that answer. */
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

/** Omits skills with no claim. */
async function loadSkillClaims(input: {
  goalId: string;
  skillIds: readonly string[];
  userId: string;
}): Promise<Map<string, SkillClaim>> {
  const dated = await loadDatedClaims(input);
  return new Map([...dated].map(([skillId, { claim }]) => [skillId, claim]));
}

/** Returns only skills assumed known without study; missing one brings its lessons back. */
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

/** Returns claimed skills not yet confirmed by practice. */
export async function loadSkillsToConfirm(input: {
  goalId: string;
  skillIds: readonly string[];
  userId: string;
}): Promise<Set<string>> {
  return listClaimed({ claim: "toConfirm", claims: await loadSkillClaims(input) });
}
