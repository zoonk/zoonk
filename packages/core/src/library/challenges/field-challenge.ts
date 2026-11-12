import "server-only";
import { type ChallengeCaseParams } from "@zoonk/ai/tasks/challenge/schema";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { createOrFindByIdentity, toProvenanceData } from "../_utils/library-rows";
import { STEP_CONTRACT_VERSION } from "../steps/contract/step-contract";
import {
  holdBackStepVariantDraft,
  reserveStepVariantGeneration,
} from "../variants/variant-generation";
import { toVariantKey } from "../variants/variant-keys";
import { toChallengeCaseInputs } from "./_utils/challenge-inputs";
import { type ScriptedChallenge } from "./challenge-draft";
import { parseChallengeLessonSpec } from "./challenge-lesson-spec";

function findFieldChallenge({ key, stepId }: { key: string; stepId: string }) {
  return prisma.stepVariant.findUnique({
    where: { stepVariantKey: { key, kind: "field", stepId } },
  });
}

function loadChallengeStep(stepId: string) {
  return prisma.step.findUnique({
    include: {
      lesson: {
        include: { homeChapter: { include: { homeCourse: true } } },
        omit: { summary: true },
      },
    },
    where: { id: stepId },
  });
}

/** Internal workflow bridge: hold the normalized field token before reserving or generating. */
export async function prepareFieldChallengeDraft({
  analytics,
  field,
  stepId,
  workflowRunId,
}: {
  analytics?: ChallengeCaseParams["analytics"];
  field: string;
  stepId: string;
  workflowRunId: string;
}) {
  const key = toVariantKey(field);

  if (!isUuid(stepId) || !key) {
    return { status: "notFound" as const };
  }

  const step = await loadChallengeStep(stepId);

  if (step?.kind !== "challenge" || step.lesson.contentStatus !== "completed") {
    return { status: "notFound" as const };
  }

  const spec = parseChallengeLessonSpec(step.lesson.spec);

  if (spec?.variant !== "work" || step.lesson.ownerId) {
    return { status: "unsupported" as const };
  }

  const reservation = await reserveStepVariantGeneration({
    key,
    kind: "field",
    stepId,
    workflowRunId,
  });

  if (reservation.status !== "reserved") {
    return reservation;
  }

  return {
    params: {
      ...toChallengeCaseInputs({ lesson: step.lesson, spec }),
      analytics: { ...analytics, contentScope: "shared" as const },
      field: key,
      problems: reservation.problems.map((problem) => problem.problem),
    },
    review: true,
    status: "challengeDraft" as const,
  };
}

export async function finishFieldChallengeDraft({
  field,
  stepId,
  workflowRunId,
  model,
  problems,
  scripted,
}: {
  field: string;
  stepId: string;
  workflowRunId: string;
  model: string;
  problems: string[];
  scripted?: ScriptedChallenge;
}) {
  const key = toVariantKey(field);

  if (problems.length > 0) {
    await holdBackStepVariantDraft({
      key,
      kind: "field",
      model,
      problems: problems.map((problem) => ({ problem, screen: null })),
      stepId,
      workflowRunId,
    });

    return { status: "heldBack" as const };
  }

  if (!scripted?.content || scripted.problems.length > 0) {
    throw new Error("A field challenge needs a checked script");
  }

  const { content, provenance } = scripted;

  const { created, row } = await createOrFindByIdentity({
    create: () =>
      prisma.stepVariant.create({
        data: {
          content,
          contractVersion: STEP_CONTRACT_VERSION,
          key,
          kind: "field",
          stepId,
          ...toProvenanceData(provenance),
        },
      }),
    findExisting: () => findFieldChallenge({ key, stepId }),
  });

  return { created, status: "ready" as const, variant: row };
}
