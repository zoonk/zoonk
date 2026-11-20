import "server-only";
import { createHash } from "node:crypto";
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
  writeLessonLines,
} from "./_utils/lesson-example-lines";

const UUID_HEX_DIGITS = 32;
const UUID_GROUPS = /^(?<time>.{8})(?<mid>.{4})(?<high>.{4})(?<clock>.{4})(?<node>.{12})$/u;

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

/** A retry of the same lesson, version and context finds this claim and isn't charged again. */
function toClaimTarget({
  contextKey,
  lessonId,
  userId,
  version,
}: {
  contextKey: string;
  lessonId: string;
  userId: string;
  version: number;
}): string {
  const hex = createHash("sha256")
    .update(`example-lines:${userId}:${lessonId}:${version}:${contextKey}`)
    .digest("hex");

  return hex.slice(0, UUID_HEX_DIGITS).replace(UUID_GROUPS, "$<time>-$<mid>-$<high>-$<clock>-$<node>");
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

/** Internal workflow bridge: the pick names no lesson, so one serves every lesson of a run. */
export async function pickExampleLineFactsFor({
  userId,
}: {
  userId: string;
}): Promise<PickedExampleLineFacts | null> {
  const context = await loadExampleLineContext({ userId });

  if (!context) {
    return null;
  }

  return { contextKey: context.key, facts: await pickExampleLineFacts({ context, userId }) };
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

  const targetId = toClaimTarget({ contextKey: context.key, lessonId, userId, version });

  const result = await writeLessonLines({
    claim: () => claimUsageFor({ kind: "assist", targetId, userId }),
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
