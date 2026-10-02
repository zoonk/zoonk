import "server-only";
import { type GenerationStatus, type TransactionClient, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import {
  getCourseCacheTag,
  getCourseCurriculumCacheTag,
  getLibraryChapterCacheTag,
  getLibraryLessonCacheTag,
} from "../../cache/tags";

/** The Library generation phases that one workflow at a time may run for a row. */
export type LibraryGenerationTarget =
  | "chapterOutline"
  | "courseOutline"
  | "lessonContent"
  | "lessonSpec";

/**
 * `claimed`: this run owns the work (also when it retries its own claim).
 * `running`: another run owns it; join that run instead of starting again.
 * `completed`: the work is done; read the result.
 */
export type LibraryClaimResult = "claimed" | "completed" | "running";

type ClaimInput = { id: string; workflowRunId: string };
type ClaimState = { runId: string | null; status: GenerationStatus | null };

type ClaimTargetOps = {
  claim: (db: TransactionClient, input: ClaimInput) => Promise<{ count: number }>;
  finish: (input: ClaimInput & { status: "completed" | "failed" }) => Promise<{ count: number }>;
  read: (db: TransactionClient, id: string) => Promise<ClaimState | null>;
  /** Clears what a failed run left behind before the new owner starts. */
  reset?: (db: TransactionClient, id: string) => Promise<unknown>;
  tags: (id: string) => string[];
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
    tags: (id) => [getLibraryChapterCacheTag(id)],
  },
  courseOutline: {
    /** Courses made before outlines existed have no outline status; their first run may claim them. */
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
    reset: (db, id) => db.step.deleteMany({ where: { lessonId: id } }),
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

/**
 * Reports who owns work this run couldn't claim. A run that retries its own
 * claim still owns it, so a retried workflow step continues instead of waiting
 * on itself.
 */
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

/** Claims with `db`: the conditional update alone, or with the reset in the caller's transaction. */
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

/**
 * Claims one generation phase of a Library row before any AI work starts. The status predicate
 * makes the claim atomic: when two workflows race for the same row, exactly one moves it to
 * `running` and the other learns who owns it. Claiming lesson content after a failed run deletes
 * that run's partial steps, in one transaction with the claim; the other phases need none.
 */
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
    revalidateCacheTags(ops.tags(id));
  }

  return result;
}

/**
 * Ends a claimed phase as completed or failed. Only the run that holds the
 * claim can end it, so a stale run finishing late never overwrites the result
 * of the run that replaced it. Returns whether this run still held the claim.
 */
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
    revalidateCacheTags(ops.tags(id));
  }

  return count > 0;
}
