import "server-only";
import { type LearningEvent, type TransactionClient, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getAllowanceCacheTag } from "../../cache/tags";
import {
  type EntitlementViewer,
  getEntitlementViewer,
} from "../../entitlements/_utils/entitlement-viewer";
import { claimUsageInWrite } from "../../entitlements/claim-usage";
import { type UsageDecision } from "../../entitlements/contract";
import { findActiveGoalId } from "../../goals/_utils/goal-view";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { startLearningEvent } from "../../stats/record-learning-event";
import { startLessonClock } from "./lesson-clock";
import { isOwnExplanation } from "./lesson-rows";
import { findResumableRun, getRunStudySessionId } from "./lesson-runs";

const LIBRARY_LESSON_KIND = "library";

type StartClaim = { lessonId: string; viewer: EntitlementViewer } | null;
type RefusedStart = { refused: Exclude<UsageDecision, { status: "allowed" }> };
type OpenedRun = { clockId: string | null; isNew: boolean; run: LearningEvent };
type ReopenedRun = Omit<OpenedRun, "isNew">;

type RunSource = {
  bindSession: boolean;
  lesson: { homeChapterId: string | null; id: string; planItems: unknown[]; title: string };
  now: Date;
  studySessionId: string | null;
  timeZone: string;
  userId: string;
};

/** A lesson played in a goal's study session is that goal's study, whichever goal is active. */
async function findRunGoalId({
  studySessionId,
  userId,
}: {
  studySessionId: string | null;
  userId: string;
}): Promise<string | null> {
  const session = studySessionId
    ? await prisma.studySession.findFirst({
        select: { goalId: true },
        where: { id: studySessionId, userId },
      })
    : null;

  return session?.goalId ?? findActiveGoalId(userId);
}

/**
 * Claims inside the run's own write, so a start waits for the learner's lock once for both and is
 * charged only when its run opens.
 */
async function claimStart({
  claim,
  tx,
}: {
  claim: StartClaim;
  tx: TransactionClient;
}): Promise<RefusedStart | { recorded: boolean }> {
  if (!claim) {
    return { recorded: false };
  }

  const { decision, recorded } = await claimUsageInWrite({
    kind: "lessonStart",
    targetId: claim.lessonId,
    transaction: tx,
    viewer: claim.viewer,
  });

  return decision.status === "allowed" ? { recorded } : { refused: decision };
}

export async function reopenRunClock({
  claim,
  lessonId,
  run,
  userId,
}: {
  claim: StartClaim;
  lessonId: string;
  run: LearningEvent;
  userId: string;
}): Promise<ReopenedRun | RefusedStart> {
  if (!claim && !getRunStudySessionId(run)) {
    return { clockId: null, run };
  }

  return writeLearnerChange<ReopenedRun | RefusedStart>({ userId }, async (tx) => {
    const usage = await claimStart({ claim, tx });

    if ("refused" in usage) {
      return unchanged(usage);
    }

    const current = await tx.learningEvent.findUniqueOrThrow({ where: { id: run.id } });
    const clockId = await startLessonClock({ lessonId, run: current, tx, userId });
    const result = { clockId, run: current };
    return clockId || usage.recorded ? result : unchanged(result);
  });
}

async function openRun({
  bindSession,
  claim,
  lesson,
  now,
  studySessionId,
  timeZone,
  userId,
}: RunSource & { claim: StartClaim }): Promise<OpenedRun | RefusedStart> {
  const [goalId, existing] = await Promise.all([
    findRunGoalId({ studySessionId, userId }),
    findResumableRun(prisma, { lessonId: lesson.id, now, userId }),
  ]);

  if (existing && (!bindSession || getRunStudySessionId(existing) === studySessionId)) {
    const reopened = await reopenRunClock({ claim, lessonId: lesson.id, run: existing, userId });

    if ("refused" in reopened) {
      return reopened;
    }

    if (!reopened.run.endedAt) {
      return { ...reopened, isNew: false };
    }
  }

  return writeLearnerChange<OpenedRun | RefusedStart>({ planInputs: true, userId }, async (tx) => {
    const usage = await claimStart({ claim, tx });

    if ("refused" in usage) {
      return unchanged(usage);
    }

    const resumable = await findResumableRun(tx, { lessonId: lesson.id, now, userId });

    if (resumable) {
      if (bindSession && studySessionId && getRunStudySessionId(resumable) !== studySessionId) {
        const run = await tx.learningEvent.update({
          data: {
            contentIds: {
              ...(isJsonObject(resumable.contentIds) ? resumable.contentIds : {}),
              studySessionId,
            },
            goalId,
          },
          where: { id: resumable.id },
        });

        return {
          clockId: await startLessonClock({ lessonId: lesson.id, run, tx, userId }),
          isNew: false,
          run,
        };
      }

      const clockId = await startLessonClock({ lessonId: lesson.id, run: resumable, tx, userId });
      const result = { clockId, isNew: false, run: resumable };
      return clockId || usage.recorded ? result : unchanged(result);
    }

    const run = await startLearningEvent(tx, {
      contentIds: {
        lessonId: lesson.id,
        ...(lesson.homeChapterId && { chapterId: lesson.homeChapterId }),
        ...(studySessionId && { studySessionId }),
      },
      goalId,
      kind: "lesson",
      lessonKind: LIBRARY_LESSON_KIND,
      startedAt: now,
      timeZone,
      titleSnapshot: lesson.title,
      userId,
    });

    return {
      clockId: await startLessonClock({ lessonId: lesson.id, run, tx, userId }),
      isNew: true,
      run,
    };
  });
}

/** Resumes the learner's recent run of the lesson or starts one, charging the start in the same write. */
export async function openLessonRun(source: RunSource): Promise<OpenedRun | RefusedStart> {
  // Quick explanations already claimed their own allowance and must not consume a lesson allowance too.
  const viewer = isOwnExplanation(source.lesson) ? null : await getEntitlementViewer();

  if (!viewer && !isOwnExplanation(source.lesson)) {
    return { refused: { status: "unauthorized" } };
  }

  const opened = await openRun({
    ...source,
    claim: viewer && { lessonId: source.lesson.id, viewer },
  });

  if (viewer && !("refused" in opened)) {
    revalidateCacheTags([getAllowanceCacheTag(source.userId)]);
  }

  return opened;
}
