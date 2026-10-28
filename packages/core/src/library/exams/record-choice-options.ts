import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getExamBlueprintCacheTag } from "../../cache/tags";
import { type ExamStructure, examStructureSchema } from "./blueprint-contract";

const RETRY_AFTER_DAYS = 30;

export type ChoiceOptionsLookup = { board: string | null; exam: string };

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

/** Internal workflow bridge: the blueprint must come from the research run that linked it. */
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

/** Internal workflow bridge: the blueprint must come from the research run that requested the lookup. */
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
