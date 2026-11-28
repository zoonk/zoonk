import "server-only";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getExamBlueprintCacheTag } from "../../cache/tags";
import { type ReadingProblem, examEditionSchema } from "./blueprint-contract";
import { type ExamIdentity, buildExamIdentityKey, findExamBlueprintByKey } from "./exam-identity";

export type NoticeReading = { problems: ReadingProblem[]; read: boolean };

export async function findNoticeReading({
  identity,
  sourceId,
}: {
  identity: ExamIdentity;
  sourceId: string;
}): Promise<NoticeReading> {
  const [blueprint, source] = await Promise.all([
    findExamBlueprintByKey({
      identityKey: buildExamIdentityKey(identity),
      language: identity.language,
    }),
    prisma.source.findUnique({ select: { contentHash: true }, where: { id: sourceId } }),
  ]);

  const edition = blueprint ? examEditionSchema.safeParse(blueprint.edition).data : undefined;

  if (edition?.setAside && edition.setAside.sourceHash === source?.contentHash) {
    return { problems: edition.setAside.problems, read: true };
  }

  if (!edition || !source || edition.sourceHash !== source.contentHash) {
    return { problems: [], read: false };
  }

  return { problems: edition.check?.problems ?? [], read: true };
}

/**
 * Records a notice version whose reading kept contradicting itself on the blueprint it would have
 * updated, which keeps its last reading, so research and freshness checks don't pay to read that
 * version again. A new exam has no blueprint to record it on.
 */
export async function setAsideNoticeReading({
  identity,
  problems,
  sourceHash,
}: {
  identity: ExamIdentity;
  problems: ReadingProblem[];
  sourceHash: string;
}): Promise<string | null> {
  const blueprint = await findExamBlueprintByKey({
    identityKey: buildExamIdentityKey(identity),
    language: identity.language,
  });

  if (!blueprint) {
    return null;
  }

  const setAside = { checkedAt: new Date().toISOString(), problems, sourceHash };

  await prisma.$executeRaw`
    UPDATE exam_blueprints
    SET edition = jsonb_set(edition, '{setAside}', ${JSON.stringify(setAside)}::jsonb)
    WHERE id = ${blueprint.id}::uuid AND edition IS NOT NULL
  `;

  revalidateCacheTags([getExamBlueprintCacheTag(blueprint.id)]);

  return blueprint.id;
}
