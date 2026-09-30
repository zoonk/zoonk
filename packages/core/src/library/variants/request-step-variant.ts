import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { after } from "next/server";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { claimAssist } from "../../entitlements/claim-usage";
import { type RefusedUsage } from "../../entitlements/contract";
import { getSession } from "../../users/get-session";
import { canViewLibraryRow } from "../_utils/library-visibility";
import { getOrCreateStepVariant } from "./get-or-create-step-variant";
import { type LearnerVariantKind } from "./variant-contract";

type StepVariantView = { content: unknown; id: string; kind: LearnerVariantKind; stepId: string };

type RequestStepVariantResult =
  | { status: "unauthorized" }
  | { status: "notFound" }
  | { status: "unsupported" }
  | { status: "failed" }
  | RefusedUsage
  | { status: "ready"; variant: StepVariantView };

async function findVisibleStep(stepId: string) {
  const step = await prisma.step.findUnique({
    select: { lesson: { select: { ownerId: true, visibility: true } } },
    where: { id: stepId },
  });

  return step && (await canViewLibraryRow(step.lesson)) ? step : null;
}

/**
 * The learner waited while a new version was written: "Generation Waited" (variant) after the
 * response, measured here because the server knows when writing started and ended. Stored versions
 * send nothing; their "Depth Requested" tap is the rest of the denominator.
 */
function trackVariantWait({ milliseconds, userId }: { milliseconds: number; userId: string }) {
  after(() =>
    trackLearnerEvents({
      events: [
        { name: "Generation Waited", properties: { content_kind: "variant", milliseconds } },
      ],
      userId,
    }),
  );
}

/**
 * "Simpler" and "Go deeper" for the signed-in learner or guest: returns the
 * shared version of a screen they can see, writing it the first time anyone
 * asks. Only a new version is claimed as small AI help (`claimAssist`), since
 * stored ones cost nothing.
 */
export async function requestStepVariant({
  kind,
  stepId,
}: {
  kind: LearnerVariantKind;
  stepId: string;
}): Promise<RequestStepVariantResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!isUuid(stepId) || !(await findVisibleStep(stepId))) {
    return { status: "notFound" };
  }

  const existing = await prisma.stepVariant.findUnique({
    where: { stepVariantKey: { key: "", kind, stepId } },
  });

  const usage = existing ? null : await claimAssist();

  if (usage && usage.status !== "allowed") {
    return usage;
  }

  const startedAt = performance.now();

  const result = existing
    ? { status: "ready" as const, variant: existing }
    : await getOrCreateStepVariant({ analytics: { distinctId: session.user.id }, kind, stepId });

  if (result.status !== "ready") {
    return { status: result.status };
  }

  if (!existing) {
    trackVariantWait({
      milliseconds: Math.round(performance.now() - startedAt),
      userId: session.user.id,
    });
  }

  const { variant } = result;

  return {
    status: "ready",
    variant: { content: variant.content, id: variant.id, kind, stepId: variant.stepId },
  };
}
