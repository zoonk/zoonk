import "server-only";
import { type generateWarmUpCards } from "@zoonk/ai/tasks/warm-up/write-warm-up-cards";
import { type WarmUp, prisma } from "@zoonk/db";
import { type CurriculumScope } from "../curriculum/curriculum-scope";
import { examStructureSchema } from "../exams/blueprint-contract";
import { type GoalWarmUp } from "./warm-up-contract";
import { getWarmUpKey } from "./warm-up-key";

export type WarmUpInput = Pick<
  Parameters<typeof generateWarmUpCards>[0],
  "goal" | "kind" | "language" | "subjects" | "targetLanguage"
>;

export type WarmUpClaim =
  | { status: "none" }
  | { id: string; status: "following" }
  | { id: string; status: "ready" }
  | { id: string; input: WarmUpInput; status: "claimed" };

const STALE_CLAIM_MS = 10 * 60 * 1000;

/** Internal workflow bridge: the calling run has already authorized its goal and decided its scope. */
export async function claimWarmUp({
  goalId,
  scope,
  workflowRunId,
}: {
  goalId: string;
  scope: CurriculumScope;
  workflowRunId: string;
}): Promise<WarmUpClaim> {
  const goal = await prisma.goal.findUnique({
    include: { examBlueprint: true },
    where: { id: goalId },
  });

  if (!goal || goal.kind === "explain") {
    return { status: "none" };
  }

  const linked = await readWarmUpState(goal.warmUpId);

  if (linked?.status === "ready") {
    return { id: linked.id, status: "ready" };
  }

  const identityKey = getWarmUpKey({ ...scope, kind: goal.kind });

  if (!identityKey || !scope.generalGoal) {
    return { status: "none" };
  }

  const languageIdentity = { identityKey, language: goal.language };

  await prisma.warmUp.createMany({
    data: [{ ...languageIdentity, runId: workflowRunId }],
    skipDuplicates: true,
  });

  const stored = await prisma.warmUp.findUniqueOrThrow({ where: { languageIdentity } });

  if (stored.status === "ready") {
    await linkWarmUp({ goalId, id: stored.id });
    return { id: stored.id, status: "ready" };
  }

  if (stored.status === "failed") {
    return { status: "none" };
  }

  // Linked while it's written, so the goal's waits know a deck is on its way.
  await linkWarmUp({ goalId, id: stored.id });

  const claimed = await prisma.warmUp.updateMany({
    data: { claimedAt: new Date(), runId: workflowRunId },
    where: {
      OR: [{ runId: workflowRunId }, { claimedAt: { lt: new Date(Date.now() - STALE_CLAIM_MS) } }],
      id: stored.id,
      status: "writing",
    },
  });

  if (claimed.count === 0) {
    const ready = await readWarmUpStatus({ goalId, id: stored.id });

    if (ready.status === "writing") {
      return { id: stored.id, status: "following" };
    }

    return ready.status === "ready" ? { id: stored.id, status: "ready" } : { status: "none" };
  }

  const blueprint = goal.examBlueprint;

  const structure =
    goal.kind === "exam" && blueprint?.visibility === "public" && !blueprint.ownerId
      ? examStructureSchema.safeParse(blueprint.structure).data
      : null;

  return {
    id: stored.id,
    input: {
      goal: scope.generalGoal,
      kind: goal.kind,
      language: goal.language,
      ...(structure && { subjects: structure.subjects.map(({ name }) => name) }),
      ...(scope.targetLanguage && { targetLanguage: scope.targetLanguage }),
    },
    status: "claimed",
  };
}

/** A goal keeps its first ready deck; until it has one, it follows the deck claimed for it. */
async function linkWarmUp({ goalId, id }: { goalId: string; id: string }): Promise<void> {
  await prisma.goal.updateMany({
    data: { warmUpId: id },
    where: { OR: [{ warmUpId: null }, { warmUp: { status: { not: "ready" } } }], id: goalId },
  });
}

/** Internal: a goal's deck as its waits see it: on its way, ready, or none once it failed. */
export async function readWarmUpState(warmUpId: string | null): Promise<GoalWarmUp | null> {
  if (!warmUpId) {
    return null;
  }

  const deck = await prisma.warmUp.findUnique({
    select: { id: true, status: true },
    where: { id: warmUpId },
  });

  if (!deck || deck.status === "failed") {
    return null;
  }

  return { id: deck.id, status: deck.status };
}

/** The one rule for which deck a learner is handed: only a ready one has its checked cards. */
export async function readReadyWarmUpId(warmUpId: string | null): Promise<string | null> {
  const deck = await readWarmUpState(warmUpId);
  return deck?.status === "ready" ? deck.id : null;
}

export async function readWarmUpStatus({
  goalId,
  id,
}: {
  goalId: string;
  id: string;
}): Promise<Pick<WarmUp, "status"> | { status: "missing" }> {
  const deck = await prisma.warmUp.findUnique({ where: { id } });

  if (deck?.status === "ready") {
    await linkWarmUp({ goalId, id });
  }

  return { status: deck?.status ?? "missing" };
}

export async function holdsWarmUpClaim({
  id,
  workflowRunId,
}: {
  id: string;
  workflowRunId: string;
}): Promise<boolean> {
  return Boolean(
    await prisma.warmUp.findFirst({ where: { id, runId: workflowRunId, status: "writing" } }),
  );
}

export async function failWarmUp({
  id,
  workflowRunId,
}: {
  id: string;
  workflowRunId: string;
}): Promise<void> {
  await prisma.warmUp.updateMany({
    data: { status: "failed" },
    where: { id, runId: workflowRunId, status: "writing" },
  });
}
