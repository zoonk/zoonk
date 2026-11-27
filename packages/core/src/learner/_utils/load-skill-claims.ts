import "server-only";
import { type Plan, type PlanItem, type TransactionClient, prisma } from "@zoonk/db";
import { getLessonSkillRows, toIdKey } from "../../library/_utils/shared-rows";
import { loadCourseStarts } from "../../plans/_utils/course-starts";
import { loadPassedOverClaims } from "../../plans/_utils/load-passed-over-claims";
import { loadUndoneTestOuts } from "../../plans/_utils/undone-test-outs";
import { LEARN_KINDS } from "../../plans/planner/plan-item-rules";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { loadGoalWritingFact } from "../writing-skills";
import { loadWritingEvidence } from "../written-evidence";
import { loadAnswerEvents } from "./load-answer-events";
import {
  type ClaimEvent,
  type DatedClaim,
  type SkillClaim,
  listAnsweredWrong,
  listClaimed,
  listKnownSkills,
  listSkippedRechecks,
  listTakenToKnow,
  readDatedClaims,
  readSkillClaims,
  readSkillConfirmations,
} from "./skill-claims";

/** GETs pass the saved plan already read; writes omit it for a fresh read. */
export type ClaimPlan = Pick<Plan, "createdAt" | "graph" | "id" | "settings"> & {
  items: Pick<PlanItem, "completedAt" | "kind" | "lessonId" | "skillId" | "status">[];
};

function isClaimingItem(item: ClaimPlan["items"][number]) {
  return (
    item.completedAt !== null &&
    LEARN_KINDS.has(item.kind) &&
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
}: {
  goalId: string;
  known?: ClaimPlan | null;
}): Promise<ClaimEvent[]> {
  const [items, plan] =
    known === undefined
      ? await Promise.all([
          prisma.planItem.findMany({
            select: { completedAt: true, lessonId: true, skillId: true, status: true },
            where: {
              completedAt: { not: null },
              kind: { in: [...LEARN_KINDS] },
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

    return claimed.map((skillId): ClaimEvent => ({
      at: item.completedAt ?? new Date(0),
      kind: item.status === "done" ? "studied" : "claim",
      skillId,
    }));
  });
}

/** Includes basics skipped by choice, dated from that choice. */
export async function loadDatedClaims({
  goalId,
  readClaims,
  skillIds,
  userId,
}: {
  goalId: string;
  readClaims?: (skillIds: readonly string[]) => Promise<ClaimEvent[]>;
  skillIds: readonly string[];
  userId: string;
}): Promise<Map<string, DatedClaim>> {
  if (skillIds.length === 0) {
    return new Map();
  }

  return readDatedClaims(
    await (readClaims ? readClaims(skillIds) : loadClaimEvents({ goalId, skillIds, userId })),
  );
}

/** Every claim the goal's plan and its history make, for any skill; answers depend on the skills asked. */
export async function loadPlanClaimEvents({
  goalId,
  plan,
  skillIds,
}: {
  goalId: string;
  plan?: ClaimPlan | null;
  /** A fresh read for these skills only skips history no asked skill needs; GETs share every skill's. */
  skillIds?: ReadonlySet<string>;
}): Promise<ClaimEvent[]> {
  const [planEvents, passedOver, undone, starts] = await Promise.all([
    loadPlanEvents({ goalId, known: plan }),
    loadPassedOverClaims({ goalId, known: plan, skillIds }),
    loadUndoneTestOuts(goalId),
    loadCourseStarts(goalId),
  ]);

  const courseClaims = [...starts].map(([skillId, start]): ClaimEvent => ({
    at: start.at,
    kind: "passedOver",
    skillId,
  }));

  const otherClaims = planEvents.filter(
    (event) =>
      event.kind !== "claim" || starts.get(event.skillId)?.at.getTime() !== event.at.getTime(),
  );

  return [...otherClaims, ...courseClaims, ...passedOver, ...undone];
}

export async function loadClaimEvents({
  goalId,
  writingFact,
  planEvents,
  skillIds,
  userId,
}: {
  goalId: string;
  /** A GET's request-wide `loadPlanClaimEvents`; without it, they're read fresh. */
  planEvents?: Promise<ClaimEvent[]>;
  writingFact?: Awaited<ReturnType<typeof loadGoalWritingFact>>;
  skillIds: readonly string[];
  userId: string;
}): Promise<ClaimEvent[]> {
  const asked = new Set(skillIds);

  const { examBlueprintId, skillIds: writtenSkills } =
    writingFact ?? (await loadGoalWritingFact(goalId));

  const writtenAsked = new Set(skillIds.filter((id) => writtenSkills.has(id)));

  const [fromPlan, answers, written] = await Promise.all([
    planEvents ?? loadPlanClaimEvents({ goalId, skillIds: asked }),
    loadAnswerEvents({ skillIds: skillIds.filter((id) => !writtenAsked.has(id)), userId }),
    loadWritingEvidence({ examBlueprintId, skillIds: writtenAsked, tx: prisma, userId }),
  ]);

  return [
    ...fromPlan.filter((event) => asked.has(event.skillId) && !writtenAsked.has(event.skillId)),
    ...answers,
    ...written,
  ];
}

export async function loadSkillConfirmations({
  goalId,
  skillIds,
  timeZone,
  today,
  tx = prisma,
  userId,
}: {
  goalId: string;
  skillIds: readonly string[];
  timeZone: string;
  today?: Date;
  tx?: TransactionClient;
  userId: string;
}) {
  if (skillIds.length === 0) {
    return { confirmed: new Set<string>(), heldUntilTomorrow: false };
  }

  const answers = await loadAnswerEvents({ skillIds, tx, userId });
  const undone = await loadUndoneTestOuts(goalId, { timeZone, tx });
  return readSkillConfirmations([...answers, ...undone], today);
}

export async function loadSkippedRecheckSkills({
  localDate,
  ...input
}: {
  goalId: string;
  localDate: Date;
  skillIds: readonly string[];
  userId: string;
}): Promise<Set<string>> {
  if (input.skillIds.length === 0) {
    return new Set();
  }

  return listSkippedRechecks({ events: await loadClaimEvents(input), localDate });
}

export async function loadSkillEvidence({
  passedOver,
  ...input
}: {
  goalId: string;
  /** The basics the learner passed over by choice, still to confirm (see `listKnownSkills`). */
  passedOver?: (skillId: string) => boolean;
  writingFact?: Awaited<ReturnType<typeof loadGoalWritingFact>>;
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
    known: listKnownSkills({ events, passedOver }),
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
  const events = await loadClaimEvents({ goalId, skillIds: [skillId], userId });

  const read = (list: readonly ClaimEvent[]) =>
    [
      listKnownSkills({ events: list }).has(skillId),
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
