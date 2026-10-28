import "server-only";
import { type StudySessionStatus, type TransactionClient, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLibraryLessonCacheTag } from "../../cache/tags";
import { toPlanChangePayload } from "../../plans/_utils/plan-change-payload";
import { getSeenChange } from "../../plans/planner/plan-effect";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { refreshGoalPlan } from "../../plans/refresh-goal-plan";
import { lockPlanSourceWrite, writePlanInputs } from "../_utils/plan-input-write";
import { type HeldBackDraft, MAX_LESSON_DRAFTS, parseHeldBackDrafts } from "./held-back-drafts";

/** A day that ended keeps what happened in it; days still running or ahead move on. */
const OPEN_SESSION_STATUSES: StudySessionStatus[] = ["planned", "active"];

/**
 * A private lesson serves one learner, so it gets no fresh draft (only reusable lessons get model
 * work beyond the first draft and its fix passes): its first held-back draft sets it aside.
 */
const PRIVATE_LESSON_DRAFTS = 1;
const PLAN_REFRESH_BATCH_SIZE = 4;

/** A superseded claim must roll back plan/learner admission as well as the attempted draft. */
class LessonClaimLostError extends Error {
  override name = "LessonClaimLostError";
}

/** A lesson item is one lesson; a stand-in, the lessons it was saved with. */
function countSavedLessons(item: { lessonId: string | null; lessons?: number | null }): number {
  return item.lessonId ? 1 : (item.lessons ?? 1);
}

/**
 * Takes a set-aside lesson out of what learners have ahead: its todo plan items are skipped and
 * open session blocks for it are skipped, so Today goes to the next stop instead of waiting on a
 * lesson nothing will write. Other lessons that teach its skills stay in the plans. Returns the
 * plan IDs whose todo work changed.
 */
export async function moveOnWithoutLesson(
  tx: TransactionClient,
  lessonId: string,
  holdKey: string,
): Promise<string[]> {
  const items = await tx.planItem.findMany({
    select: { id: true, planId: true, titleSnapshot: true },
    where: { lessonId, status: "todo" },
  });

  const planIds = [...new Set(items.map((item) => item.planId))];

  const plans = await tx.plan.findMany({
    select: {
      graph: true,
      id: true,
      items: {
        select: {
          chapterId: true,
          id: true,
          kind: true,
          lessonId: true,
          lessons: true,
          phase: true,
          scheduledFor: true,
          skillId: true,
          status: true,
          titleSnapshot: true,
        },
      },
    },
    where: { id: { in: planIds } },
  });

  const planById = new Map(plans.map((plan) => [plan.id, plan]));

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

  await Promise.all(
    [...Map.groupBy(items, (item) => item.planId)].map(async ([planId, removed]) => {
      const plan = planById.get(planId);
      const before = plan?.items ?? [];
      const ids = new Set(removed.map((item) => item.id));

      const effect = getSeenChange({
        after: before.map((item) =>
          ids.has(item.id) ? { ...item, status: "skipped" as const } : item,
        ),
        before,
        graph: parsePlanGraph(plan?.graph),
        lessonsAfter: countSavedLessons,
        lessonsBefore: countSavedLessons,
      });

      await tx.planChange.create({
        data: {
          kind: "estimateUpdated",
          payload: toPlanChangePayload({ effect, lessonHoldKey: holdKey, source: "system" }),
          planId,
          reason: "An unplayable lesson was set aside.",
          status: "applied",
        },
      });
    }),
  );

  return planIds;
}

/** The committed loss records retain exactly the plans changed by this quality hold. */
export async function readHeldPlanIds(tx: TransactionClient, holdKey: string): Promise<string[]> {
  const losses = await tx.planChange.findMany({
    select: { planId: true },
    where: { kind: "estimateUpdated", payload: { equals: holdKey, path: ["lessonHoldKey"] } },
  });

  return [...new Set(losses.map((loss) => loss.planId))];
}

/** The quality write removes unplayable blocks immediately; its response also waits for the saved plan. */
export async function refreshPlansWithoutLesson(planIds: readonly string[]): Promise<string[]> {
  const plans = await prisma.plan.findMany({
    select: { goal: { select: { userId: true } }, goalId: true },
    where: { id: { in: [...planIds] } },
  });

  const failures: Error[] = [];

  for (let offset = 0; offset < plans.length; offset += PLAN_REFRESH_BATCH_SIZE) {
    // Bound planning work while letting every affected plan refresh before a failed batch retries.
    // oxlint-disable-next-line no-await-in-loop
    const results = await Promise.allSettled(
      plans
        .slice(offset, offset + PLAN_REFRESH_BATCH_SIZE)
        .map((plan) => refreshGoalPlan({ goalId: plan.goalId })),
    );

    for (const result of results) {
      if (result.status === "rejected") {
        failures.push(
          result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
        );
      }
    }
  }

  const [failure] = failures;

  if (failure) {
    throw failure;
  }

  return [...new Set(plans.map((plan) => plan.goal.userId))];
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
  const holdKey = `${lessonId}:${workflowRunId}`;

  const { data: heldBack, error } = await safeAsync(() =>
    writePlanInputs(async (tx) => {
      const lesson = await tx.lesson.findFirst({
        select: { contentStatus: true, heldBackDrafts: true, ownerId: true, setAsideAt: true },
        where: { contentRunId: workflowRunId, id: lessonId },
      });

      if (!lesson) {
        return null;
      }

      const previous = parseHeldBackDrafts(lesson.heldBackDrafts);

      if (lesson.contentStatus !== "running") {
        const saved = previous.find((draft) => draft.runId === workflowRunId);

        return lesson.setAsideAt && saved
          ? { planIds: await readHeldPlanIds(tx, holdKey), setAside: true }
          : null;
      }

      const now = new Date();
      const draft = { heldBackAt: now.toISOString(), model, problems, runId: workflowRunId };
      const drafts = [...previous, draft];

      const setAside =
        drafts.length >= (lesson.ownerId ? PRIVATE_LESSON_DRAFTS : MAX_LESSON_DRAFTS);

      await lockPlanSourceWrite(tx, { lessonIds: [lessonId] });

      const planIds = setAside ? await moveOnWithoutLesson(tx, lessonId, holdKey) : [];

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

      return { planIds, setAside };
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

  const userIds = heldBack.setAside ? await refreshPlansWithoutLesson(heldBack.planIds) : [];

  revalidateCacheTags([
    getLibraryLessonCacheTag(lessonId),
    ...userIds.map((userId) => getGoalsCacheTag(userId)),
  ]);

  return { setAside: heldBack.setAside };
}
