import "server-only";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { type ServiceTier } from "@zoonk/ai/provider-options";
import { prisma } from "@zoonk/db";
import { createListeningSet } from "../../library/listening/create-listening-set";
import { type ListeningExam, loadListeningExam } from "./listening-exam";
import { type ListeningPart } from "./listening-parts";
import { loadListeningSkills } from "./listening-skills";
import { MAX_SETS_PER_PART, getPartSetsFilter, pickListeningSets } from "./pick-listening-sets";

type PartInput = { exam: ListeningExam; part: ListeningPart };

export type PartsToPrepare = { exam: ListeningExam; parts: ListeningPart[] };

function getFilter({ exam, part }: PartInput) {
  return getPartSetsFilter({
    examBlueprintId: exam.blueprintId,
    scriptLanguage: exam.scriptLanguage,
    task: part.task,
  });
}

export async function findUnvoicedPartSet(input: PartInput): Promise<string | null> {
  const set = await prisma.itemSet.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
    where: { ...getFilter(input), mediaAssetId: null },
  });

  return set?.id ?? null;
}

/** Internal workflow bridge for shared content; callers must supply a trusted exam. */
export async function writePartSet({
  analytics,
  exam,
  part,
  serviceTier,
}: PartInput & { analytics?: AiGenerationContext; serviceTier?: ServiceTier }): Promise<
  string | null
> {
  const [stored, skills] = await Promise.all([
    prisma.itemSet.count({ where: getFilter({ exam, part }) }),
    loadListeningSkills({ examBlueprintId: exam.blueprintId, sectionName: part.sectionName }),
  ]);

  if (stored >= MAX_SETS_PER_PART) {
    return null;
  }

  return createListeningSet({
    analytics,
    exam: { blueprintId: exam.blueprintId, name: exam.name },
    language: exam.language,
    part,
    scriptLanguage: exam.scriptLanguage,
    serviceTier,
    skills,
  });
}

async function listUnvoicedParts(exam: ListeningExam): Promise<ListeningPart[]> {
  const voiced = await Promise.all(
    exam.parts.map((part) =>
      prisma.itemSet.count({
        where: { ...getFilter({ exam, part }), mediaAssetId: { not: null } },
      }),
    ),
  );

  return exam.parts.filter((_, index) => voiced[index] === 0);
}

/** Internal: the caller must derive an optional `userId` from the authenticated session. */
export async function listListeningPartsToPrepare({
  goalId,
  userId,
}: {
  goalId: string;
  userId?: string;
}): Promise<PartsToPrepare | null> {
  const exam = await loadListeningExam(goalId);

  if (!exam) {
    return null;
  }

  if (!userId) {
    return { exam, parts: await listUnvoicedParts(exam) };
  }

  const picks = await pickListeningSets({
    examBlueprintId: exam.blueprintId,
    parts: exam.parts,
    scriptLanguage: exam.scriptLanguage,
    userId,
  });

  return { exam, parts: picks.filter((pick) => pick.needsSet).map((pick) => pick.part) };
}
