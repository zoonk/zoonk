import "server-only";
import { type StudySessionStatus, type TransactionClient } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLibraryLessonCacheTag } from "../../cache/tags";
import { lockPlanSourceWrite, writePlanInputs } from "../_utils/plan-input-write";
import { type HeldBackDraft, MAX_LESSON_DRAFTS, parseHeldBackDrafts } from "./held-back-drafts";

/** A day that ended keeps what happened in it; days still running or ahead move on. */
const OPEN_SESSION_STATUSES: StudySessionStatus[] = ["planned", "active"];

/**
 * A private lesson serves one learner, so it gets no fresh draft (only reusable lessons get model
 * work beyond the first draft and its fix passes): its first held-back draft sets it aside.
 */
const PRIVATE_LESSON_DRAFTS = 1;

/** A superseded claim must roll back plan/learner admission as well as the attempted draft. */
class LessonClaimLostError extends Error {
  override name = "LessonClaimLostError";
}

/**
 * Takes a set-aside lesson out of what learners have ahead: its todo plan items are skipped and
 * open session blocks for it are skipped, so Today goes to the next stop instead of waiting on a
 * lesson nothing will write. Other lessons that teach its skills stay in the plans. Returns the
 * learners whose plans changed.
 */
export async function moveOnWithoutLesson(
  tx: TransactionClient,
  lessonId: string,
): Promise<string[]> {
  const items = await tx.planItem.findMany({
    select: { id: true, plan: { select: { goal: { select: { userId: true } } } } },
    where: { lessonId, status: "todo" },
  });

  /** Queue changes lock blocks before plan items; use the same order to avoid a cycle. */
  const blocks = await tx.$queryRaw<{ id: string }[]>`
    SELECT block.id FROM study_session_blocks AS block
    JOIN study_sessions AS session ON session.id = block.session_id
    WHERE block.kind = 'learn' AND block.lesson_id = ${lessonId}::uuid
      AND session.status IN ('planned', 'active') AND block.status IN ('active', 'pending')
    ORDER BY block.id FOR UPDATE OF block
  `;

  await tx.studySessionBlock.updateMany({
    data: { status: "skipped" },
    where: {
      id: { in: blocks.map((block) => block.id) },
      kind: "learn",
      lessonId,
      session: { status: { in: OPEN_SESSION_STATUSES } },
      status: { in: ["active", "pending"] },
    },
  });

  await tx.planItem.updateMany({
    data: { status: "skipped" },
    where: { id: { in: items.map((item) => item.id) }, status: "todo" },
  });

  return [...new Set(items.map((item) => item.plan.goal.userId))];
}

/**
 * Ends the content claim of a run whose draft the quality gate held back: the claim ends as
 * failed and the draft is recorded with its writer and problems, so the next draft is told what
 * held it back (and the last one comes from another writer). When that was the lesson's last
 * allowed draft (a private lesson's first), the lesson is set aside and every plan moves on
 * without it. Returns null when this run no longer held the claim.
 */
export async function holdBackLessonDraft({
  lessonId,
  model,
  problems,
  workflowRunId,
}: {
  lessonId: string;
  model: string;
  problems: HeldBackDraft["problems"];
  workflowRunId: string;
}): Promise<{ setAside: boolean } | null> {
  const { data: heldBack, error } = await safeAsync(() =>
    writePlanInputs(async (tx) => {
      const lesson = await tx.lesson.findFirst({
        select: { heldBackDrafts: true, ownerId: true },
        where: { contentRunId: workflowRunId, contentStatus: "running", id: lessonId },
      });

      if (!lesson) {
        return null;
      }

      const now = new Date();
      const draft = { heldBackAt: now.toISOString(), model, problems, runId: workflowRunId };
      const drafts = [...parseHeldBackDrafts(lesson.heldBackDrafts), draft];

      const setAside =
        drafts.length >= (lesson.ownerId ? PRIVATE_LESSON_DRAFTS : MAX_LESSON_DRAFTS);

      await lockPlanSourceWrite(tx, { lessonIds: [lessonId] });

      const { count } = await tx.lesson.updateMany({
        data: {
          contentStatus: "failed",
          heldBackDrafts: drafts,
          setAsideAt: setAside ? now : null,
        },
        where: { contentRunId: workflowRunId, contentStatus: "running", id: lessonId },
      });

      if (count === 0) {
        throw new LessonClaimLostError();
      }

      const userIds = setAside ? await moveOnWithoutLesson(tx, lessonId) : [];
      return { setAside, userIds };
    }),
  );

  if (error instanceof LessonClaimLostError) {
    return null;
  }

  if (error) {
    throw error;
  }

  if (!heldBack) {
    return null;
  }

  revalidateCacheTags([
    getLibraryLessonCacheTag(lessonId),
    ...heldBack.userIds.map((userId) => getGoalsCacheTag(userId)),
  ]);

  return { setAside: heldBack.setAside };
}
