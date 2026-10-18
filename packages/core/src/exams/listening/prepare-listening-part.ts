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

/** The goal's exam and the parts of it a run makes a set ready for. */
export type PartsToPrepare = { exam: ListeningExam; parts: ListeningPart[] };

function getFilter({ exam, part }: PartInput) {
  return getPartSetsFilter({
    examBlueprintId: exam.blueprintId,
    scriptLanguage: exam.scriptLanguage,
    task: part.task,
  });
}

/**
 * A set of the part that was written but never voiced (its voicing failed), the oldest first:
 * voicing it is cheaper than writing another.
 */
export async function findUnvoicedPartSet(input: PartInput): Promise<string | null> {
  const set = await prisma.itemSet.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
    where: { ...getFilter(input), mediaAssetId: null },
  });

  return set?.id ?? null;
}

/**
 * Writes and stores one more set for the part (`createListeningSet`), on the skills of the exam's
 * listening section, unless the part already has its most sets (`MAX_SETS_PER_PART`). Returns the
 * stored set's id, to voice next. An internal workflow bridge: shared content, no learner data.
 */
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

/** Whether each part has a voiced set: a part without one can't be played to anyone yet. */
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

/**
 * The parts of the goal's exam a run makes a set ready for (`listeningSetsWorkflow`). For the
 * goal's setup, those with no voiced set yet: the first learner of an exam pays for one recording
 * per part, and every later one finds them made. For a learner (`userId`, derived from their
 * session by the caller), also those where they heard every set and the part can have more
 * (`pickListeningSets`), so their next practice plays a new one. Null when the goal has no
 * listening.
 */
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
