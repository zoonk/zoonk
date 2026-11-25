import "server-only";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../../cache/tags";
import { researchUploadAnswerSchema } from "../../follow-ups/follow-up-contract";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { type ResearchUploadAnswerKey } from "./goal-upload-request";
import { followSourceRedirects } from "./own-sources";
import { getSourceReadStatus } from "./source-read-status";

export async function getOwedResearchUploadAnswer({ answerId, userId }: ResearchUploadAnswerKey) {
  const row = await prisma.followUp.findUnique({
    select: { id: true, input: true, revision: true },
    where: { userKindKey: { key: answerId, kind: "answerResearchUpload", userId } },
  });

  if (!row) {
    return null;
  }

  const input = researchUploadAnswerSchema.parse(row.input);
  return { ...input, id: row.id, revision: row.revision, userId };
}

type OwedResearchUploadAnswer = NonNullable<
  Awaited<ReturnType<typeof getOwedResearchUploadAnswer>>
>;

export async function getReadableResearchUploadIds({
  claimedSourceIds,
  sourceIds,
}: Pick<OwedResearchUploadAnswer, "claimedSourceIds" | "sourceIds">): Promise<string[]> {
  const [ids, claimedIds] = await Promise.all([
    followSourceRedirects(sourceIds),
    followSourceRedirects(claimedSourceIds),
  ]);

  const sources = await prisma.source.findMany({
    select: { extractedText: true, id: true, readState: true },
    where: { id: { in: ids } },
  });

  const readable = new Set(
    sources.filter((source) => getSourceReadStatus(source) === "readable").map(({ id }) => id),
  );

  return claimedIds.some((id) => readable.has(id)) ? ids.filter((id) => readable.has(id)) : [];
}

export async function reopenResearchUploadAnswer({
  goalId,
  id,
  reason,
  revision,
  userId,
}: OwedResearchUploadAnswer): Promise<void> {
  const reopened = await writeLearnerChange({ userId }, async (tx) => {
    const ended = await tx.followUp.deleteMany({ where: { id, revision } });

    if (ended.count === 0) {
      return unchanged(false);
    }

    const { count } = await tx.goal.updateMany({
      data: { researchUploadReason: reason },
      where: { id: goalId, researchUploadReason: null, userId },
    });

    return count > 0;
  });

  if (reopened) {
    revalidateCacheTags([getGoalsCacheTag(userId)]);
  }
}
