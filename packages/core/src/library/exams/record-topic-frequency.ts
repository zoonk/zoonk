import "server-only";
import { type ExamBlueprint, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getExamBlueprintCacheTag } from "../../cache/tags";
import {
  type PastTopicFrequency,
  examStructureSchema,
  topicFrequencySchema,
} from "./blueprint-contract";
import { listUnratedSubjects, needsTopicFrequency } from "./topic-frequency";

/** What research needs to look up how often a blueprint's topics are asked, when it needs it. */
export type TopicFrequencyLookup = {
  board: string | null;
  exam: string;
  /** The subjects whose topics nothing rates yet, with their topics in the notice's words. */
  subjects: { name: string; topics: string[] }[];
};

function describeExam(blueprint: Pick<ExamBlueprint, "name" | "role">): string {
  return blueprint.role ? `${blueprint.name}, ${blueprint.role}` : blueprint.name;
}

/**
 * The lookup a shared blueprint needs for how often its topics are asked (see
 * `needsTopicFrequency`), with the subjects nothing rates yet; null when it needs none.
 *
 * This is a workflow bridge: the blueprint comes from the research run that linked it.
 */
export async function findTopicFrequencyLookup({
  examBlueprintId,
  now = new Date(),
}: {
  examBlueprintId: string;
  now?: Date;
}): Promise<TopicFrequencyLookup | null> {
  const blueprint = await prisma.examBlueprint.findUnique({ where: { id: examBlueprintId } });
  const structure = examStructureSchema.safeParse(blueprint?.structure).data;
  const topicFrequency = topicFrequencySchema.safeParse(blueprint?.topicFrequency).data ?? [];

  if (
    !blueprint ||
    blueprint.ownerId ||
    !structure ||
    !needsTopicFrequency({ now, structure, topicFrequency })
  ) {
    return null;
  }

  return {
    board: blueprint.board,
    exam: describeExam(blueprint),
    subjects: listUnratedSubjects({ structure, topicFrequency }).map((subject) => ({
      name: subject.name,
      topics: subject.topics,
    })),
  };
}

/**
 * Stores what the lookup found on the blueprint's structure, next to what earlier lookups found
 * for other subjects, with when it ran (also when it found nothing): the plan's weights and the
 * subject pages read it from there.
 *
 * This is a workflow bridge: the blueprint comes from the research run that looked it up.
 */
export async function recordTopicFrequency({
  examBlueprintId,
  now = new Date(),
  subjects,
}: {
  examBlueprintId: string;
  now?: Date;
  subjects: PastTopicFrequency["subjects"];
}): Promise<void> {
  const blueprint = await prisma.examBlueprint.findUnique({
    select: { structure: true },
    where: { id: examBlueprintId },
  });

  const earlier = examStructureSchema.safeParse(blueprint?.structure).data?.pastTopicFrequency;
  const found = new Set(subjects.map((subject) => subject.name));

  const pastTopicFrequency: PastTopicFrequency = {
    checkedAt: now.toISOString(),
    subjects: [
      ...(earlier?.subjects ?? []).filter((subject) => !found.has(subject.name)),
      ...subjects,
    ],
  };

  // One statement sets only this lookup, so the ones run at the same time are never overwritten.
  await prisma.$executeRaw`
    UPDATE exam_blueprints
    SET structure = jsonb_set(structure, '{pastTopicFrequency}', ${JSON.stringify(pastTopicFrequency)}::jsonb),
      updated_at = ${now}
    WHERE id = ${examBlueprintId}::uuid
  `;

  revalidateCacheTags([getExamBlueprintCacheTag(examBlueprintId)]);
}
