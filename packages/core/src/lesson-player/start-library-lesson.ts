import "server-only";
import { type LearningEvent, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { type UsageDecision } from "../entitlements/contract";
import { getLearnerTimeZone } from "../learner/_utils/goal-time-zone";
import { saveDayBeforeActivity } from "../sessions/ensure-study-session";
import { type StudyBlockOpening } from "../sessions/open-block-contract";
import { getSession } from "../users/get-session";
import { trackLessonStarted } from "./_utils/lesson-events";
import { findLessonStudySessionId, getRunHyperdrive } from "./_utils/lesson-hyperdrive";
import {
  findOpenedVersion,
  findPlayableLessonRow,
  findStartableLesson,
} from "./_utils/lesson-rows";
import {
  findLessonRun,
  getRunStudySessionId,
  hasFinishedLessonBefore,
  loadProgressAnswers,
  loadProgressSince,
} from "./_utils/lesson-runs";
import { resolveLessonStudyOpening } from "./_utils/lesson-study-opening";
import { loadPlayableSteps } from "./_utils/load-playable-steps";
import { openLessonRun, reopenRunClock } from "./_utils/open-lesson-run";
import { restoreRunAnswers } from "./_utils/restore-run-answers";
import { getLatePictureStepIds } from "./_utils/screen-pictures";
import { type LibraryLessonRun, type LibraryLessonStartInput } from "./contract";

export type LibraryLessonStartOutcome =
  | Exclude<UsageDecision, { status: "allowed" }>
  | { run: LibraryLessonRun; status: "started" }
  | { status: "notFound" }
  | { opening: StudyBlockOpening; status: "opened" }
  | { status: "retryable" };

async function loadRunProgress({
  lessonId,
  run,
  userId,
}: {
  lessonId: string;
  run: LearningEvent;
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

  const studySessionId = getRunStudySessionId(run);

  const [answers, hyperdrive] = await Promise.all([
    restoreRunAnswers({ attempts, lesson: { ...lesson, steps }, userId }),
    getRunHyperdrive({ run, steps: lesson.steps, studySessionId, userId }),
  ]);

  return {
    answers,
    hyperdrive,
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
  const [progress, replay, saved] = await Promise.all([
    loadRunProgress({ lessonId, run, userId }),
    hasFinishedLessonBefore(prisma, { lessonId, runId: run.id, userId }),
    prisma.savedLesson.count({ where: { lessonId, userId } }),
  ]);

  return progress
    ? {
        ...progress,
        clockId,
        replay,
        runId: run.id,
        saved: Boolean(saved),
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

  const studySessionId = opening
    ? opening.sessionId
    : await findLessonStudySessionId({
        lessonId: lesson.id,
        studySessionId: input.studySessionId,
        userId,
      });

  const opened = await openLessonRun({
    bindSession: opening !== null,
    lesson,
    now,
    studySessionId,
    timeZone: await getLearnerTimeZone({ timeZone: input.timeZone, userId }),
    userId,
  });

  if ("refused" in opened) {
    return opened.refused;
  }

  const { clockId, isNew, run } = opened;

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
      ? await reopenRunClock({ claim: null, lessonId, run: requested, userId })
      : null;

  const run =
    reopened && "run" in reopened && !reopened.run.endedAt
      ? await readRun({ ...reopened, lessonId, userId })
      : null;

  return run ? { run, status: "started" } : { status: "notFound" };
}
