import "server-only";
import { prisma } from "@zoonk/db";
import { resolveDeeperByDefault } from "../../profile/_utils/deeper-by-default";

/** Deeper versions one preparation writes at most; the next preparation writes the rest. */
const MAX_DEEPER_VERSIONS = 30;

/** A private course's screens are personal content, counted to their owner. */
export type DeeperVersionTarget = { ownerId: string | null; stepId: string };

/**
 * The explanation screens of a learner's next lessons that have no "Go deeper" version yet, when
 * their lessons open that version first (their setting, or memory while it's on), in the order the
 * lessons are given (the plan's), so the lessons the learner opens first get theirs first. The
 * versions are shared, so each is written once for everyone and the lesson opens on it without a
 * wait.
 */
export async function listDeeperVersionTargets({
  lessonIds,
  userId,
}: {
  lessonIds: readonly string[];
  userId: string;
}): Promise<DeeperVersionTarget[]> {
  if (lessonIds.length === 0) {
    return [];
  }

  const profile = await prisma.userLearningProfile.findUnique({
    select: { deeperByDefault: true, memoryAsksDeeper: true, memoryEnabled: true },
    where: { userId },
  });

  if (!resolveDeeperByDefault(profile).deeperByDefault) {
    return [];
  }

  const steps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    select: { id: true, lesson: { select: { ownerId: true } }, lessonId: true },
    where: {
      itemId: null,
      kind: "explanation",
      lesson: { contentStatus: "completed" },
      lessonId: { in: [...lessonIds] },
      variants: { none: { kind: "deeper" } },
    },
  });

  const lessonOrder = new Map(lessonIds.map((lessonId, index) => [lessonId, index]));

  return steps
    .toSorted(
      (first, second) =>
        (lessonOrder.get(first.lessonId) ?? 0) - (lessonOrder.get(second.lessonId) ?? 0),
    )
    .slice(0, MAX_DEEPER_VERSIONS)
    .map((step) => ({ ownerId: step.lesson.ownerId, stepId: step.id }));
}
