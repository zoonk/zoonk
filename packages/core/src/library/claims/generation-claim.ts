import "server-only";
import { type GenerationStatus, type TransactionClient, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import {
  getCourseCacheTag,
  getCourseCurriculumCacheTag,
  getLibraryLessonCacheTag,
} from "../../cache/tags";
import { getChapterCacheTags } from "../chapters/chapter-cache-tags";
import { startLessonVersion } from "../lessons/lesson-versions";

export type LibraryGenerationTarget =
  | "chapterOutline"
  | "courseOutline"
  | "lessonContent"
  | "lessonSpec";

export type LibraryClaimResult = "claimed" | "completed" | "running";

type ClaimInput = { id: string; workflowRunId: string };
type ClaimState = { runId: string | null; status: GenerationStatus | null };

type ClaimTargetOps = {
  claim: (db: TransactionClient, input: ClaimInput) => Promise<{ count: number }>;
  finish: (input: ClaimInput & { status: "completed" | "failed" }) => Promise<{ count: number }>;
  read: (db: TransactionClient, id: string) => Promise<ClaimState | null>;
  reset?: (db: TransactionClient, id: string) => Promise<unknown>;
  tags: (id: string) => Promise<string[]> | string[];
};

const CLAIMABLE_STATUSES: GenerationStatus[] = ["pending", "failed"];

const CLAIM_TARGETS: Readonly<Record<LibraryGenerationTarget, ClaimTargetOps>> = {
  chapterOutline: {
    claim: (db, { id, workflowRunId }) =>
      db.chapter.updateMany({
        data: { outlineRunId: workflowRunId, outlineStatus: "running" },
        where: { id, outlineStatus: { in: CLAIMABLE_STATUSES } },
      }),
    finish: ({ id, status, workflowRunId }) =>
      prisma.chapter.updateMany({
        data: { outlineStatus: status },
        where: { id, outlineRunId: workflowRunId, outlineStatus: "running" },
      }),
    read: async (db, id) => {
      const chapter = await db.chapter.findUnique({ where: { id } });
      return chapter && { runId: chapter.outlineRunId, status: chapter.outlineStatus };
    },
    tags: (id) => getChapterCacheTags(id),
  },
  courseOutline: {
    claim: (db, { id, workflowRunId }) =>
      db.course.updateMany({
        data: { outlineRunId: workflowRunId, outlineStatus: "running" },
        where: { OR: [{ outlineStatus: { in: CLAIMABLE_STATUSES } }, { outlineStatus: null }], id },
      }),
    finish: ({ id, status, workflowRunId }) =>
      prisma.course.updateMany({
        data: { outlineStatus: status },
        where: { id, outlineRunId: workflowRunId, outlineStatus: "running" },
      }),
    read: async (db, id) => {
      const course = await db.course.findUnique({ where: { id } });
      return course && { runId: course.outlineRunId, status: course.outlineStatus };
    },
    tags: (id) => [getCourseCacheTag(id), getCourseCurriculumCacheTag(id)],
  },
  lessonContent: {
    claim: (db, { id, workflowRunId }) =>
      db.lesson.updateMany({
        data: { contentRunId: workflowRunId, contentStatus: "running" },
        where: { contentStatus: { in: CLAIMABLE_STATUSES }, id },
      }),
    finish: ({ id, status, workflowRunId }) =>
      prisma.lesson.updateMany({
        data: { contentStatus: status },
        where: { contentRunId: workflowRunId, contentStatus: "running", id },
      }),
    read: async (db, id) => {
      const lesson = await db.lesson.findUnique({
        omit: { spec: true, summary: true },
        where: { id },
      });

      return lesson && { runId: lesson.contentRunId, status: lesson.contentStatus };
    },
    reset: (db, id) => startLessonVersion(db, id),
    tags: (id) => [getLibraryLessonCacheTag(id)],
  },
  lessonSpec: {
    claim: (db, { id, workflowRunId }) =>
      db.lesson.updateMany({
        data: { specRunId: workflowRunId, specStatus: "running" },
        where: { id, specStatus: { in: CLAIMABLE_STATUSES } },
      }),
    finish: ({ id, status, workflowRunId }) =>
      prisma.lesson.updateMany({
        data: { specStatus: status },
        where: { id, specRunId: workflowRunId, specStatus: "running" },
      }),
    read: async (db, id) => {
      const lesson = await db.lesson.findUnique({
        omit: { spec: true, summary: true },
        where: { id },
      });

      return lesson && { runId: lesson.specRunId, status: lesson.specStatus };
    },
    tags: (id) => [getLibraryLessonCacheTag(id)],
  },
};

function toClaimResult({
  state,
  workflowRunId,
}: {
  state: ClaimState;
  workflowRunId: string;
}): LibraryClaimResult {
  if (state.status === "completed") {
    return "completed";
  }

  if (state.status === "running" && state.runId === workflowRunId) {
    return "claimed";
  }

  return "running";
}

async function claimWith(
  db: TransactionClient,
  {
    id,
    ops,
    target,
    workflowRunId,
  }: ClaimInput & { ops: ClaimTargetOps; target: LibraryGenerationTarget },
): Promise<{ changed: boolean; result: LibraryClaimResult }> {
  const claim = await ops.claim(db, { id, workflowRunId });

  if (claim.count > 0) {
    await ops.reset?.(db, id);
    return { changed: true, result: "claimed" };
  }

  const state = await ops.read(db, id);

  if (!state) {
    throw new Error(`Cannot claim ${target} for missing row ${id}.`);
  }

  return { changed: false, result: toClaimResult({ state, workflowRunId }) };
}

/** Claim a phase before starting AI work; only `claimed` grants ownership of generation. */
export async function claimLibraryGeneration({
  id,
  target,
  workflowRunId,
}: ClaimInput & { target: LibraryGenerationTarget }): Promise<LibraryClaimResult> {
  const ops = CLAIM_TARGETS[target];
  const input = { id, ops, target, workflowRunId };

  const { changed, result } = ops.reset
    ? await prisma.$transaction((tx) => claimWith(tx, input))
    : await claimWith(prisma, input);

  if (changed) {
    revalidateCacheTags(await ops.tags(id));
  }

  return result;
}

/** Returns false if another run replaced the claim; callers must not treat that as completion. */
export async function finishLibraryGeneration({
  id,
  status,
  target,
  workflowRunId,
}: ClaimInput & {
  status: "completed" | "failed";
  target: LibraryGenerationTarget;
}): Promise<boolean> {
  const ops = CLAIM_TARGETS[target];
  const { count } = await ops.finish({ id, status, workflowRunId });

  if (count > 0) {
    revalidateCacheTags(await ops.tags(id));
  }

  return count > 0;
}
