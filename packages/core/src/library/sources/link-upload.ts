import "server-only";
import { oweFollowUps } from "../../follow-ups/owe-follow-ups";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { linkGoalSources } from "./link-goal-sources";
import { type SourceStructure } from "./source-contract";

export async function linkUpload({
  goalId,
  sourceId,
  uploadId,
  userId,
  visualReading,
}: {
  goalId: string | null;
  sourceId: string;
  uploadId: string;
  userId: string;
  visualReading?: { legacyStructure?: SourceStructure };
}) {
  return writeLearnerChange({ userId }, async (tx) => {
    const uploads = await tx.sourceUpload.createMany({
      data: { id: uploadId, sourceId, userId },
      skipDuplicates: true,
    });

    const linked = await tx.learnerSource.createMany({
      data: { origin: "upload", sourceId, userId },
      skipDuplicates: true,
    });

    const uploaded =
      linked.count > 0
        ? linked
        : await tx.learnerSource.updateMany({
            data: { origin: "upload" },
            where: { origin: { not: "upload" }, sourceId, userId },
          });

    const attached = goalId
      ? await linkGoalSources(tx, { goalId, origin: "upload", sourceIds: [sourceId], userId })
      : 0;

    const reowed =
      uploads.count > 0 && visualReading
        ? await tx.source.updateMany({
            data: { readState: "owed", structure: visualReading.legacyStructure },
            where: {
              id: sourceId,
              ownerId: userId,
              readState: visualReading.legacyStructure ? null : "failed",
            },
          })
        : { count: 0 };

    if (reowed.count > 0) {
      await tx.goalSource.updateMany({
        data: { answeredAt: null },
        where: { answeredAt: { not: null }, goal: { userId }, sourceId },
      });

      await oweFollowUps({
        db: tx,
        followUps: [{ input: { sourceId }, kind: "readUpload" }],
        userId,
      });
    }

    return uploads.count + uploaded.count + attached === 0 ? unchanged(null) : null;
  });
}
