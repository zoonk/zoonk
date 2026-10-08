import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getExamBlueprintCacheTag } from "../../cache/tags";
import { type ExamStructure, examStructureSchema } from "./blueprint-contract";

/** A lookup that found nothing is tried again after this long: a paper may be published. */
const RETRY_AFTER_DAYS = 30;

/** What research needs to look up how many options a blueprint's questions have. */
export type ChoiceOptionsLookup = { board: string | null; exam: string };

/**
 * Whether research looks up the number of options: the exam asks multiple choice, its notice
 * doesn't say how many options, and no lookup found it (or one found nothing a month ago).
 */
function needsPastOptions({ now, structure }: { now: Date; structure: ExamStructure }): boolean {
  const unstated = structure.formats.some(
    (format) => format.kind === "multipleChoice" && format.options === null,
  );

  const past = structure.pastOptions;

  if (!unstated || past?.options) {
    return false;
  }

  return (
    !past || now.getTime() - new Date(past.checkedAt).getTime() >= RETRY_AFTER_DAYS * MS_PER_DAY
  );
}

/**
 * The lookup a shared blueprint needs for its number of options (see `needsPastOptions`), or null
 * when it needs none. A private blueprint, read from a learner's material, is never searched.
 *
 * This is a workflow bridge: the blueprint comes from the research run that linked it.
 */
export async function findChoiceOptionsLookup({
  examBlueprintId,
  now = new Date(),
}: {
  examBlueprintId: string;
  now?: Date;
}): Promise<ChoiceOptionsLookup | null> {
  const blueprint = await prisma.examBlueprint.findUnique({ where: { id: examBlueprintId } });
  const structure = examStructureSchema.safeParse(blueprint?.structure).data;

  if (!blueprint || blueprint.ownerId || !structure || !needsPastOptions({ now, structure })) {
    return null;
  }

  return {
    board: blueprint.board,
    exam: blueprint.role ? `${blueprint.name}, ${blueprint.role}` : blueprint.name,
  };
}

/**
 * Stores what the lookup found, or that it found nothing, on the blueprint's structure, where
 * every reader of its formats takes it (`getExamFormats`). One statement sets only this lookup,
 * so the subjects' counts looked up at the same time are never overwritten.
 *
 * This is a workflow bridge: the blueprint comes from the research run that looked it up.
 */
export async function recordChoiceOptions({
  edition,
  examBlueprintId,
  now = new Date(),
  options,
  source,
}: {
  edition: string | null;
  examBlueprintId: string;
  now?: Date;
  /** Null when nothing was found. */
  options: number | null;
  source: { title: string | null; url: string } | null;
}): Promise<void> {
  const pastOptions: NonNullable<ExamStructure["pastOptions"]> = {
    checkedAt: now.toISOString(),
    edition: options === null ? null : edition,
    options,
    source: options === null ? null : source,
  };

  await prisma.$executeRaw`
    UPDATE exam_blueprints
    SET structure = jsonb_set(structure, '{pastOptions}', ${JSON.stringify(pastOptions)}::jsonb),
      updated_at = ${now}
    WHERE id = ${examBlueprintId}::uuid
  `;

  revalidateCacheTags([getExamBlueprintCacheTag(examBlueprintId)]);
}
