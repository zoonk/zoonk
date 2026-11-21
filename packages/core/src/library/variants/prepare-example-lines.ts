import "server-only";
import { prisma } from "@zoonk/db";
import { claimUsageFor } from "../../entitlements/claim-usage";
import { readCurrentLessonVersion } from "../lessons/lesson-versions";
import { type ExampleLineContext, loadExampleLineContext } from "./_utils/example-line-context";
import {
  type ExampleLineFact,
  findMissingScreens,
  loadLessonOfStep,
  loadSlotScreens,
  pickExampleLineFacts,
  toExampleLineClaimTarget,
  writeLessonLines,
} from "./_utils/lesson-example-lines";

export type PickedExampleLineFacts = { contextKey: string; facts: ExampleLineFact[] };

async function needsLines({
  context,
  lessonId,
  userId,
}: {
  context: ExampleLineContext;
  lessonId: string;
  userId: string;
}): Promise<boolean> {
  const version = await readCurrentLessonVersion(lessonId);

  if (version === null) {
    return false;
  }

  const { missing } = await findMissingScreens({ context, lessonId, userId, version });
  return missing.length > 0;
}

/**
 * Internal workflow bridge: `userId` and `lessonIds` must come from `getSessionPreparationAccess`.
 * Keeps plan order, so each lesson's lines are written knowing the ones before it.
 */
export async function listExampleLineLessons({
  lessonIds,
  userId,
}: {
  lessonIds: readonly string[];
  userId: string;
}): Promise<string[]> {
  const context = await loadExampleLineContext({ userId });

  if (!context || lessonIds.length === 0) {
    return [];
  }

  const written = await prisma.lesson.findMany({
    select: { id: true },
    where: { contentStatus: "completed", id: { in: [...lessonIds] } },
  });

  const writtenIds = new Set(written.map((lesson) => lesson.id));
  const candidates = lessonIds.filter((lessonId) => writtenIds.has(lessonId));

  const needed = await Promise.all(
    candidates.map((lessonId) => needsLines({ context, lessonId, userId })),
  );

  return candidates.filter((_, index) => needed[index]);
}

/**
 * Internal workflow bridge: the pick names no lesson, so one serves every lesson of a run. It's
 * admitted by the first lesson's claim, which that lesson's write then finds already made.
 */
export async function pickExampleLineFactsFor({
  firstLessonId,
  userId,
}: {
  firstLessonId: string;
  userId: string;
}): Promise<PickedExampleLineFacts | null> {
  const [context, version] = await Promise.all([
    loadExampleLineContext({ userId }),
    readCurrentLessonVersion(firstLessonId),
  ]);

  if (!context || version === null) {
    return null;
  }

  const targetId = toExampleLineClaimTarget({
    contextKey: context.key,
    lessonId: firstLessonId,
    userId,
    version,
  });

  const usage = await claimUsageFor({ kind: "assist", targetId, userId });

  if (usage.status !== "allowed") {
    return null;
  }

  return {
    contextKey: context.key,
    facts: await pickExampleLineFacts({ context, inStep: true, userId }),
  };
}

/**
 * Internal workflow bridge: writes a lesson's lines ahead at the background tier. Skips when what
 * the learner shared changed since the pick; the lesson's own request writes them then.
 */
export async function writeLessonExampleLines({
  lessonId,
  picked,
  userId,
}: {
  lessonId: string;
  picked: PickedExampleLineFacts;
  userId: string;
}): Promise<"refused" | "skipped" | "written"> {
  const [context, version] = await Promise.all([
    loadExampleLineContext({ userId }),
    readCurrentLessonVersion(lessonId),
  ]);

  if (context?.key !== picked.contextKey || version === null) {
    return "skipped";
  }

  const [firstSlot] = await loadSlotScreens({ lessonId, version });
  const lesson = firstSlot ? await loadLessonOfStep(firstSlot.id) : null;

  if (!lesson) {
    return "skipped";
  }

  const result = await writeLessonLines({
    claim: (targetId) => claimUsageFor({ kind: "assist", targetId, userId }),
    context,
    country: lesson.country,
    facts: picked.facts,
    language: lesson.language,
    lessonId,
    userId,
    version,
    wait: "later",
  });

  return result.status === "ready" ? "written" : "refused";
}
