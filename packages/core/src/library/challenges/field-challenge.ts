import "server-only";
import { type ChallengeCaseParams } from "@zoonk/ai/tasks/v2/challenge/case";
import { type StepVariant, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { createOrFindByIdentity, toProvenanceData } from "../_utils/library-rows";
import { STEP_CONTRACT_VERSION } from "../steps/contract/step-contract";
import { toVariantKey } from "../variants/variant-keys";
import { draftChallengeCase, toChallengeCaseInputs } from "./_utils/draft-challenge";
import { parseChallengeLessonSpec } from "./challenge-lesson-spec";

export type FieldChallengeResult =
  | { status: "failed"; problems: string[] }
  | { status: "notFound" }
  | { status: "ready"; created: boolean; variant: StepVariant }
  | { status: "unsupported" };

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

/**
 * The version of a chapter's work case set in one field ("nursing"), written the first time a
 * learner in that field reaches the challenge and then shared by everyone in it, as a `field`
 * version of the challenge screen. The case still trains the chapter's skills; only where it
 * happens changes. A "What if" (overview) challenge and a private course's challenge have none:
 * the first stays light by design, the second is already built for its learner.
 *
 * This is an internal workflow bridge: the field is a shared key, never the learner's words.
 */
export async function getOrCreateFieldChallenge({
  analytics,
  field,
  stepId,
}: {
  analytics?: ChallengeCaseParams["analytics"];
  field: string;
  stepId: string;
}): Promise<FieldChallengeResult> {
  const key = toVariantKey(field);

  if (!isUuid(stepId) || !key) {
    return { status: "notFound" };
  }

  const existing = await findFieldChallenge({ key, stepId });

  if (existing) {
    return { created: false, status: "ready", variant: existing };
  }

  const step = await loadChallengeStep(stepId);

  if (step?.kind !== "challenge" || step.lesson.contentStatus !== "completed") {
    return { status: "notFound" };
  }

  const spec = parseChallengeLessonSpec(step.lesson.spec);

  if (spec?.variant !== "work" || step.lesson.ownerId) {
    return { status: "unsupported" };
  }

  const drafted = await draftChallengeCase({
    analytics: { contentScope: "shared", ...analytics },
    inputs: { ...toChallengeCaseInputs({ lesson: step.lesson, spec }), field: key },
  });

  if (!drafted.content) {
    return { problems: drafted.problems, status: "failed" };
  }

  const { content, provenance } = drafted;

  // Personal versions are read outside the shared lesson cache, so it isn't touched.
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

  return { created, status: "ready", variant: row };
}
