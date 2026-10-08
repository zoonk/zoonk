import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { createCheckpointLearner } from "./checkpoint-fixtures";

type MilestoneKind = "belt" | "glasses";

/**
 * A learner with Zu whose session today is done (its one checkpoint played), with one milestone
 * earned and not celebrated yet: opening the session shows its summary and the milestone's moment.
 */
export async function createCeremonyLearner({ key, kind }: { key: string; kind: MilestoneKind }) {
  const { block, user } = await createCheckpointLearner();

  const [milestone] = await Promise.all([
    prisma.milestone.create({ data: { key, kind, userId: user.id } }),
    learningProfileFixture({ buddyKind: "zu", userId: user.id }),
    prisma.studySessionBlock.update({ data: { status: "completed" }, where: { id: block.id } }),
    prisma.studySession.update({ data: { status: "completed" }, where: { id: block.sessionId } }),
  ]);

  return { milestone, user };
}
