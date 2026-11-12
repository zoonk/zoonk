import "server-only";
import {
  type StepVariantGeneration,
  type StepVariantKind,
  type TransactionClient,
  prisma,
} from "@zoonk/db";
import {
  type HeldBackDraft,
  getLessonDraftLimit,
  parseHeldBackDrafts,
} from "../generation/held-back-drafts";
import { toVariantKey } from "./variant-keys";

export const MAX_VARIANT_RESERVATIONS = 8;

type VariantIdentity = { stepId: string; kind: StepVariantKind; key: string };
type VariantAttempt = VariantIdentity & { workflowRunId: string };

export function isVariantGenerationExhausted({
  generation,
  ownerId,
}: {
  generation: Pick<StepVariantGeneration, "claimedRunIds" | "heldBackDrafts"> | undefined;
  ownerId: string | null;
}): boolean {
  return Boolean(
    generation &&
    (generation.claimedRunIds.length >= MAX_VARIANT_RESERVATIONS ||
      parseHeldBackDrafts(generation.heldBackDrafts).length >= getLessonDraftLimit(ownerId)),
  );
}

function identity(input: VariantIdentity): VariantIdentity {
  return { key: toVariantKey(input.key), kind: input.kind, stepId: input.stepId };
}

async function lockGeneration(tx: TransactionClient, input: VariantIdentity) {
  await tx.stepVariantGeneration.createMany({ data: [input], skipDuplicates: true });

  await tx.$queryRaw`
    SELECT id FROM step_variant_generations
    WHERE step_id = ${input.stepId}::uuid AND kind = ${input.kind}::"StepVariantKind" AND key = ${input.key}
    FOR UPDATE
  `;

  return tx.stepVariantGeneration.findUniqueOrThrow({ where: { stepVariantGenerationKey: input } });
}

/** Internal workflow capability; callers authorize the step and coordinate expensive field runs. */
export async function readStepVariantGenerationSummary(input: VariantIdentity) {
  const key = identity(input);

  const step = await prisma.step.findUnique({
    select: {
      lesson: { select: { ownerId: true } },
      variantGenerations: { where: { key: key.key, kind: key.kind } },
      variants: { where: { key: key.key, kind: key.kind } },
    },
    where: { id: key.stepId },
  });

  if (!step) {
    return null;
  }

  const [generation] = step.variantGenerations;

  return {
    claimedRunIds: generation?.claimedRunIds ?? [],
    exhausted: isVariantGenerationExhausted({ generation, ownerId: step.lesson.ownerId }),
    heldBackDrafts: parseHeldBackDrafts(generation?.heldBackDrafts),
    variant: step.variants[0] ?? null,
  };
}

/** A replay without a saved outcome may retry provider work using its original reservation. */
export async function reserveStepVariantGeneration(input: VariantAttempt) {
  const key = identity(input);

  if (!key.key) {
    throw new Error("A variant requires a normalized key.");
  }

  return prisma.$transaction(async (tx) => {
    const generation = await lockGeneration(tx, key);
    const variant = await tx.stepVariant.findUnique({ where: { stepVariantKey: key } });

    if (variant) {
      return { status: "ready" as const, variant };
    }

    const drafts = parseHeldBackDrafts(generation.heldBackDrafts);
    const previous = drafts.find((draft) => draft.runId === input.workflowRunId);

    if (previous) {
      return { draft: previous, status: "heldBack" as const };
    }

    if (generation.claimedRunIds.includes(input.workflowRunId)) {
      return { problems: drafts.flatMap((draft) => draft.problems), status: "reserved" as const };
    }

    const step = await tx.step.findUniqueOrThrow({
      select: { lesson: { select: { ownerId: true } } },
      where: { id: key.stepId },
    });

    if (isVariantGenerationExhausted({ generation, ownerId: step.lesson.ownerId })) {
      return { status: "exhausted" as const };
    }

    await tx.stepVariantGeneration.update({
      data: { claimedRunIds: { push: input.workflowRunId } },
      where: { id: generation.id },
    });

    return { problems: drafts.flatMap((draft) => draft.problems), status: "reserved" as const };
  });
}

/** Only rejected content is held back; provider errors leave the reservation spent without a draft. */
export async function holdBackStepVariantDraft(
  input: VariantAttempt & { model: string; problems: HeldBackDraft["problems"] },
): Promise<HeldBackDraft> {
  const key = identity(input);

  return prisma.$transaction(async (tx) => {
    const generation = await lockGeneration(tx, key);

    if (!generation.claimedRunIds.includes(input.workflowRunId)) {
      throw new Error("A variant draft requires a reservation.");
    }

    const drafts = parseHeldBackDrafts(generation.heldBackDrafts);
    const previous = drafts.find((draft) => draft.runId === input.workflowRunId);

    if (previous) {
      return previous;
    }

    const draft = {
      heldBackAt: new Date().toISOString(),
      model: input.model,
      problems: input.problems,
      runId: input.workflowRunId,
    };

    await tx.stepVariantGeneration.update({
      data: { heldBackDrafts: [...drafts, draft] },
      where: { id: generation.id },
    });

    return draft;
  });
}
