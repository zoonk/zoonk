import "server-only";
import {
  type GenerateStepVariantParams,
  type StepVariantKind,
  VARIANT_SCREEN_KINDS,
  generateStepVariant,
} from "@zoonk/ai/tasks/v2/variants/step-variant";
import { type StepVariant, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { createOrFindByIdentity, toProvenanceData } from "../_utils/library-rows";
import { STEP_CONTRACT_VERSION } from "../steps/contract/step-contract";
import { toVariantContent } from "./_utils/variant-content";
import { toVariantKey } from "./variant-keys";

/** One retry covers a draft that fails the checks; learners are waiting, so there's no third try. */
const GENERATION_ATTEMPTS = 2;

type VariantScreenKind = (typeof VARIANT_SCREEN_KINDS)[number];

/** Depth versions exist for teaching screens; checks only get field and tool versions. */
const SUPPORTED_SCREENS: Readonly<Record<StepVariantKind, readonly VariantScreenKind[]>> = {
  deeper: ["explanation", "workedExample"],
  field: ["explanation", "workedExample", "check"],
  simpler: ["explanation", "workedExample"],
  tool: ["explanation", "workedExample", "check"],
};

export type StepVariantResult =
  | { status: "notFound" }
  | { status: "unsupported" }
  | { status: "failed"; problems: string[] }
  | { status: "ready"; created: boolean; variant: StepVariant };

type GeneratedVariant =
  | { content: object; provenance: Awaited<ReturnType<typeof generateStepVariant>>["provenance"] }
  | { problems: string[] };

/** "Simpler" and "Go deeper" have no key; a field or tool is a slug such as "nursing" or "google-sheets". */
function normalizeVariantKey({ key, kind }: { key: string; kind: StepVariantKind }): string | null {
  if (kind === "simpler" || kind === "deeper") {
    return "";
  }

  return toVariantKey(key) || null;
}

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

function findVariant({
  key,
  kind,
  stepId,
}: {
  key: string;
  kind: StepVariantKind;
  stepId: string;
}) {
  return prisma.stepVariant.findUnique({ where: { stepVariantKey: { key, kind, stepId } } });
}

async function generateVariantContent({
  analytics,
  attempt = 1,
  key,
  kind,
  step,
}: {
  analytics: GenerateStepVariantParams["analytics"];
  attempt?: number;
  /** The field or tool as the model reads it, such as the tool's full name. */
  key: string;
  kind: StepVariantKind;
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
    variant: kind,
  });

  const converted = toVariantContent({
    kind,
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
    ? generateVariantContent({ analytics, attempt: attempt + 1, key, kind, step })
    : { problems: converted.problems };
}

/**
 * Returns the shared "Simpler", "Go deeper", field or tool version of a lesson
 * screen, writing it the first time anyone needs it. The `(step, kind, key)`
 * unique key makes it one row for everyone: when two requests race, both end
 * with the row that was stored first. Drafts pass the same contract and text
 * checks as lessons, with one retry. No cache holds versions (lesson reads load
 * them fresh), so a new one expires nothing and is seen at once in every app.
 *
 * This is the internal capability: it doesn't read the session, so planner
 * workflows can make field and tool versions. Learners reach depth versions
 * through `requestStepVariant`.
 */
export async function getOrCreateStepVariant({
  analytics,
  key = "",
  kind,
  label,
  stepId,
}: {
  analytics?: GenerateStepVariantParams["analytics"];
  key?: string;
  kind: StepVariantKind;
  /**
   * How the model reads the key when it says more than the slug: a tool's full name with its
   * choices ("Spreadsheet (Google Sheets or Excel)") for the key "spreadsheet".
   */
  label?: string;
  stepId: string;
}): Promise<StepVariantResult> {
  const variantKey = normalizeVariantKey({ key, kind });

  if (!isUuid(stepId)) {
    return { status: "notFound" };
  }

  if (variantKey === null) {
    return { status: "unsupported" };
  }

  const existing = await findVariant({ key: variantKey, kind, stepId });

  if (existing) {
    return { created: false, status: "ready", variant: existing };
  }

  const step = await loadStep(stepId);

  if (step?.lesson.contentStatus !== "completed") {
    return { status: "notFound" };
  }

  if (!isVariantScreen(step.kind) || !SUPPORTED_SCREENS[kind].includes(step.kind) || step.itemId) {
    return { status: "unsupported" };
  }

  const generated = await generateVariantContent({
    analytics: { contentScope: "shared", ...analytics },
    key: label ?? variantKey,
    kind,
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
          kind,
          stepId,
          ...toProvenanceData(generated.provenance),
        },
      }),
    findExisting: () => findVariant({ key: variantKey, kind, stepId }),
  });

  return { created, status: "ready", variant: row };
}
