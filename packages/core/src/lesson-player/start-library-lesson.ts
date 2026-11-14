import "server-only";
import { type LearningEvent, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { isUuid } from "@zoonk/utils/uuid";
import { claimUsage } from "../entitlements/claim-usage";
import { type UsageDecision } from "../entitlements/contract";
import { findActiveGoalId } from "../goals/_utils/goal-view";
import { getLearnerTimeZone } from "../learner/_utils/goal-time-zone";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { saveDayBeforeActivity } from "../sessions/ensure-study-session";
import { type StudyBlockOpening } from "../sessions/open-block-contract";
import { startLearningEvent } from "../stats/record-learning-event";
import { getSession } from "../users/get-session";
import { startLessonClock } from "./_utils/lesson-clock";
import { trackLessonStarted } from "./_utils/lesson-events";
import { findLessonStudySessionId, getRunHyperdrive } from "./_utils/lesson-hyperdrive";
import {
  findOpenedVersion,
  findPlayableLessonRow,
  findStartableLesson,
  isOwnExplanation,
} from "./_utils/lesson-rows";
import {
  findLessonRun,
  findResumableRun,
  getRunStudySessionId,
  hasFinishedLessonBefore,
  loadProgressAnswers,
  loadProgressSince,
} from "./_utils/lesson-runs";
import { resolveLessonStudyOpening } from "./_utils/lesson-study-opening";
import { loadPlayableSteps } from "./_utils/load-playable-steps";
import { restoreRunAnswers } from "./_utils/restore-run-answers";
import { getLatePictureStepIds } from "./_utils/screen-pictures";
import { type LibraryLessonRun, type LibraryLessonStartInput } from "./contract";

const LIBRARY_LESSON_KIND = "library";

export type LibraryLessonStartOutcome =
  | Exclude<UsageDecision, { status: "allowed" }>
  | { run: LibraryLessonRun; status: "started" }
  | { status: "notFound" }
  | { opening: StudyBlockOpening; status: "opened" }
  | { status: "retryable" };

type RunSource = {
  bindSession: boolean;
  lesson: { homeChapterId: string | null; id: string; title: string };
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

async function openLessonRun({
  bindSession,
  lesson,
  now,
  studySessionId,
  timeZone,
  userId,
}: RunSource) {
  const [goalId, existing] = await Promise.all([
    findRunGoalId({ studySessionId, userId }),
    findResumableRun(prisma, { lessonId: lesson.id, now, userId }),
  ]);

  if (existing && (!bindSession || getRunStudySessionId(existing) === studySessionId)) {
    const reopened = await reopenRunClock({ lessonId: lesson.id, run: existing, userId });

    if (!reopened.run.endedAt) {
      return { ...reopened, isNew: false };
    }
  }

  return writeLearnerChange({ planInputs: true, userId }, async (tx) => {
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
      return clockId ? result : unchanged(result);
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

async function loadRunProgress({
  lessonId,
  run,
  userId,
}: {
  lessonId: string;
  run: { startedAt: Date };
  userId: string;
}) {
  const since = await loadProgressSince({ lessonId, until: run.startedAt, userId });
  const version = await findOpenedVersion({ lessonId, since, userId });

  const [attempts, lesson] = await Promise.all([
    loadProgressAnswers({ lessonId, since, userId, version }),
    findPlayableLessonRow({ lessonId, userId, version }),
  ]);

  if (!lesson) {
    return null;
  }

  const answeredIds = new Set(attempts.map((attempt) => attempt.stepId));

  const steps = await loadPlayableSteps({
    lesson,
    rows: lesson.steps.filter((row) => answeredIds.has(row.id)),
  });

  return {
    answers: await restoreRunAnswers({ attempts, lesson: { ...lesson, steps }, userId }),
    optionalStepIds: [
      ...getLatePictureStepIds({ rows: lesson.steps, runStartedAt: run.startedAt }),
    ],
  };
}

async function readRun({
  clockId,
  lessonId,
  run,
  userId,
}: {
  lessonId: string;
  run: LearningEvent;
  userId: string;
  clockId: string | null;
}): Promise<LibraryLessonRun | null> {
  const [progress, hyperdrive, replay] = await Promise.all([
    loadRunProgress({ lessonId, run, userId }),
    getRunHyperdrive({ lessonId, run, studySessionId: getRunStudySessionId(run), userId }),
    hasFinishedLessonBefore(prisma, { lessonId, runId: run.id, userId }),
  ]);

  return progress
    ? {
        ...progress,
        clockId,
        hyperdrive,
        replay,
        runId: run.id,
        sessionId: getRunStudySessionId(run),
        startedAt: run.startedAt.toISOString(),
      }
    : null;
}

/** Requires a learner or guest session; retries within half an hour resume the run and restarts do not consume lesson allowance again. */
export async function startLibraryLesson({
  input,
  lessonId,
}: {
  input: LibraryLessonStartInput;
  lessonId: string;
}): Promise<LibraryLessonStartOutcome> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!isUuid(lessonId) || (input.runId !== undefined && !isUuid(input.runId))) {
    return { status: "notFound" };
  }

  const userId = session.user.id;

  // Continuing an admitted run does not repeat new-start admission when limits or the local day change.
  if (input.runId) {
    return resumeLessonRun({ lessonId, runId: input.runId, userId });
  }

  const now = new Date();
  // An explicit study opening must resolve to its admitted work before this lesson consumes allowance. Changed or unavailable study work never falls back to a standalone run.
  const opening = input.opening
    ? await resolveLessonStudyOpening({
        lessonId,
        now,
        opening: input.opening,
        timeZone: input.timeZone,
        userId,
      })
    : null;

  if (opening && opening.status !== "admitted") {
    return opening;
  }

  const lesson = await findStartableLesson({ lessonId, userId });

  if (!lesson) {
    return { status: "notFound" };
  }

  // A standalone lesson settles the block of the day it began in, so the day saved here and the run's start share one instant.
  if (!input.opening) {
    await saveDayBeforeActivity({ now, timeZone: input.timeZone, userId });
  }

  // Quick explanations already claimed their own allowance and must not consume a lesson allowance too.
  if (!isOwnExplanation(lesson)) {
    const usage = await claimUsage({ kind: "lessonStart", targetId: lesson.id });

    if (usage.status !== "allowed") {
      return usage;
    }
  }

  const studySessionId = opening
    ? opening.sessionId
    : await findLessonStudySessionId({
        lessonId: lesson.id,
        studySessionId: input.studySessionId,
        userId,
      });

  const { clockId, isNew, run } = await openLessonRun({
    bindSession: opening !== null,
    lesson,
    now,
    studySessionId,
    timeZone: await getLearnerTimeZone({ timeZone: input.timeZone, userId }),
    userId,
  });

  if (isNew) {
    trackLessonStarted({
      isGuest: session.user.isAnonymous === true,
      lessonId: lesson.id,
      run,
      stepCount: lesson._count.steps,
    });
  }

  const started = await readRun({ clockId, lessonId: lesson.id, run, userId });
  return started ? { run: started, status: "started" } : { status: "notFound" };
}

async function resumeLessonRun({
  lessonId,
  runId,
  userId,
}: {
  lessonId: string;
  runId: string;
  userId: string;
}): Promise<LibraryLessonStartOutcome> {
  const requested = await findLessonRun({ lessonId, runId, userId });

  const reopened =
    requested && !requested.endedAt
      ? await reopenRunClock({ lessonId, run: requested, userId })
      : null;

  const run =
    reopened && !reopened.run.endedAt ? await readRun({ ...reopened, lessonId, userId }) : null;

  return run ? { run, status: "started" } : { status: "notFound" };
}

async function reopenRunClock({
  lessonId,
  run,
  userId,
}: {
  lessonId: string;
  run: LearningEvent;
  userId: string;
}) {
  if (!getRunStudySessionId(run)) {
    return { clockId: null, run };
  }

  return writeLearnerChange({ userId }, async (tx) => {
    const current = await tx.learningEvent.findUniqueOrThrow({ where: { id: run.id } });
    const clockId = await startLessonClock({ lessonId, run: current, tx, userId });
    const result = { clockId, run: current };
    return clockId ? result : unchanged(result);
  });
}
