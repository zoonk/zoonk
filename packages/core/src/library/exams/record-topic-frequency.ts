import "server-only";
import { type ExamBlueprint, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getExamBlueprintCacheTag } from "../../cache/tags";
import { lockPlanBlueprintWrite, writePlanInputs } from "../_utils/plan-input-write";
import {
  type PastTopicFrequency,
  examStructureSchema,
  topicFrequencySchema,
} from "./blueprint-contract";
import { listUnratedSubjects, needsTopicFrequency } from "./topic-frequency";

export type TopicFrequencyLookup = {
  board: string | null;
  exam: string;
  subjects: { name: string; topics: string[] }[];
};

function describeExam(blueprint: Pick<ExamBlueprint, "name" | "role">): string {
  return blueprint.role ? `${blueprint.name}, ${blueprint.role}` : blueprint.name;
}

/** Internal workflow bridge: the blueprint must come from the research run that linked it. */
export async function findTopicFrequencyLookup({
  examBlueprintId,
}: {
  examBlueprintId: string;
}): Promise<TopicFrequencyLookup | null> {
  const blueprint = await prisma.examBlueprint.findUnique({ where: { id: examBlueprintId } });
  const structure = examStructureSchema.safeParse(blueprint?.structure).data;
  const topicFrequency = topicFrequencySchema.safeParse(blueprint?.topicFrequency).data ?? [];

  if (
    !blueprint ||
    blueprint.ownerId ||
    !structure ||
    !needsTopicFrequency({ now: new Date(), structure, topicFrequency })
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

/** Internal workflow bridge: the blueprint must come from the research run that requested the lookup. */
export async function recordTopicFrequency({
  complete = true,
  examBlueprintId,
  subjects,
}: {
  complete?: boolean;
  examBlueprintId: string;
  subjects: PastTopicFrequency["subjects"];
}): Promise<void> {
  const blueprint = await prisma.examBlueprint.findUnique({
    select: { structure: true },
    where: { id: examBlueprintId },
  });

  const earlier = examStructureSchema.safeParse(blueprint?.structure).data?.pastTopicFrequency;
  const found = new Set(subjects.map((subject) => subject.name));
  const now = new Date();

  const pastTopicFrequency: PastTopicFrequency = {
    checkedAt: complete ? now.toISOString() : null,
    subjects: [
      ...(earlier?.subjects ?? []).filter((subject) => !found.has(subject.name)),
      ...subjects,
    ],
  };

  await writePlanInputs(async (tx) => {
    await lockPlanBlueprintWrite(tx, examBlueprintId);

    await tx.$executeRaw`
      UPDATE exam_blueprints
      SET structure = jsonb_set(structure, '{pastTopicFrequency}', ${JSON.stringify(pastTopicFrequency)}::jsonb),
        updated_at = ${now}
      WHERE id = ${examBlueprintId}::uuid
    `;
  });

  revalidateCacheTags([getExamBlueprintCacheTag(examBlueprintId)]);
}
