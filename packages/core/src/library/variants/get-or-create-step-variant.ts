import "server-only";
import {
  type GenerateStepVariantParams,
  VARIANT_SCREEN_KINDS,
  generateStepVariant,
} from "@zoonk/ai/tasks/v2/variants/step-variant";
import { type StepVariant, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { createOrFindByIdentity, toProvenanceData } from "../_utils/library-rows";
import { STEP_CONTRACT_VERSION } from "../steps/contract/step-contract";
import { toVariantContent } from "./_utils/variant-content";
import { toVariantKey } from "./variant-keys";

const GENERATION_ATTEMPTS = 2;

const TOOL_KIND = "tool";

type VariantScreenKind = (typeof VARIANT_SCREEN_KINDS)[number];

export type StepVariantResult =
  | { status: "notFound" }
  | { status: "unsupported" }
  | { status: "failed"; problems: string[] }
  | { status: "ready"; created: boolean; variant: StepVariant };

type GeneratedVariant =
  | { content: object; provenance: Awaited<ReturnType<typeof generateStepVariant>>["provenance"] }
  | { problems: string[] };

function isVariantScreen(kind: string): kind is VariantScreenKind {
  return VARIANT_SCREEN_KINDS.some((screenKind) => screenKind === kind);
}

function loadStep(stepId: string) {
  return prisma.step.findUnique({
    include: {
      lesson: { select: { contentStatus: true, language: true, level: true, title: true } },
    },
    where: { id: stepId },
  });
}

type VariantStep = NonNullable<Awaited<ReturnType<typeof loadStep>>>;

function findVariant({ key, stepId }: { key: string; stepId: string }) {
  return prisma.stepVariant.findUnique({
    where: { stepVariantKey: { key, kind: TOOL_KIND, stepId } },
  });
}

async function generateVariantContent({
  analytics,
  attempt = 1,
  key,
  step,
}: {
  analytics: GenerateStepVariantParams["analytics"];
  attempt?: number;
  key: string;
  step: VariantStep & { kind: VariantScreenKind };
}): Promise<GeneratedVariant> {
  const { lesson } = step;

  const { data, provenance } = await generateStepVariant({
    analytics,
    key,
    language: lesson.language,
    lessonTitle: lesson.title,
    level: lesson.level,
    screen: { content: step.content, kind: step.kind },
  });

  const converted = toVariantContent({
    language: lesson.language,
    level: lesson.level,
    original: step.content,
    stepKind: step.kind,
    written: data,
  });

  if (converted.ok) {
    return { content: converted.content, provenance };
  }

  return attempt < GENERATION_ATTEMPTS
    ? generateVariantContent({ analytics, attempt: attempt + 1, key, step })
    : { problems: converted.problems };
}

/** Internal capability without a session check; callers must authorize access before requesting a version. */
export async function getOrCreateStepVariant({
  analytics,
  key,
  label,
  stepId,
}: {
  analytics?: GenerateStepVariantParams["analytics"];
  key: string;
  label?: string;
  stepId: string;
}): Promise<StepVariantResult> {
  const variantKey = toVariantKey(key);

  if (!isUuid(stepId)) {
    return { status: "notFound" };
  }

  if (!variantKey) {
    return { status: "unsupported" };
  }

  const existing = await findVariant({ key: variantKey, stepId });

  if (existing) {
    return { created: false, status: "ready", variant: existing };
  }

  const step = await loadStep(stepId);

  if (step?.lesson.contentStatus !== "completed") {
    return { status: "notFound" };
  }

  if (!isVariantScreen(step.kind) || step.itemId) {
    return { status: "unsupported" };
  }

  const generated = await generateVariantContent({
    analytics: { contentScope: "shared", ...analytics },
    key: label ?? variantKey,
    step: { ...step, kind: step.kind },
  });

  if ("problems" in generated) {
    return { problems: generated.problems, status: "failed" };
  }

  const { created, row } = await createOrFindByIdentity({
    create: () =>
      prisma.stepVariant.create({
        data: {
          content: generated.content,
          contractVersion: STEP_CONTRACT_VERSION,
          key: variantKey,
          kind: TOOL_KIND,
          stepId,
          ...toProvenanceData(generated.provenance),
        },
      }),
    findExisting: () => findVariant({ key: variantKey, stepId }),
  });

  return { created, status: "ready", variant: row };
}
