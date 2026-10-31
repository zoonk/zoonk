import "server-only";
import { type LearningEvent, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { claimUsage } from "../entitlements/claim-usage";
import { type UsageDecision } from "../entitlements/contract";
import { findActiveGoalId } from "../goals/_utils/goal-view";
import { getLearnerTimeZone } from "../learner/_utils/goal-time-zone";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { isLessonPlusOnly } from "../sessions/_utils/plus-only-lessons";
import { saveDayBeforeActivity } from "../sessions/ensure-study-session";
import { startLearningEvent } from "../stats/record-learning-event";
import { getSession } from "../users/get-session";
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
  loadProgressAnswers,
  loadProgressRuns,
} from "./_utils/lesson-runs";
import { getRunLessonSupport, loadLessonSupport } from "./_utils/lesson-support";
import { getLatePictureStepIds } from "./_utils/screen-pictures";
import { type LibraryLessonRun, type LibraryLessonStartInput } from "./contract";

const LIBRARY_LESSON_KIND = "library";

/** `plusRequired`: a free exam plan past its first week holds this new lesson of its plan for Plus. */
export type LibraryLessonStartOutcome =
  | Exclude<UsageDecision, { status: "allowed" }>
  | { run: LibraryLessonRun; status: "started" }
  | { status: "notFound" }
  | { status: "plusRequired" };

type RunSource = {
  lesson: { homeChapterId: string | null; id: string; title: string };
  studySessionId: string | null;
  timeZone: string;
  userId: string;
};

async function openLessonRun({ lesson, studySessionId, timeZone, userId }: RunSource) {
  const [goalId, existing] = await Promise.all([
    findActiveGoalId(userId),
    findResumableRun(prisma, { lessonId: lesson.id, now: new Date(), userId }),
  ]);

  if (existing) {
    return { isNew: false, run: existing };
  }

  return writeLearnerChange({ planInputs: true, userId }, async (tx) => {
    const now = new Date();
    const resumable = await findResumableRun(tx, { lessonId: lesson.id, now, userId });

    if (resumable) {
      return unchanged({ isNew: false, run: resumable });
    }

    const [first] = await loadProgressRuns({ client: tx, lessonId: lesson.id, until: now, userId });

    const support =
      (first && getRunLessonSupport(first)) ??
      (await loadLessonSupport({ client: tx, lessonId: lesson.id, userId }));

    const run = await startLearningEvent(tx, {
      contentIds: {
        lessonId: lesson.id,
        ...(support && { support }),
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

    return { isNew: true, run };
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
  const sittings = await loadProgressRuns({ lessonId, until: run.startedAt, userId });
  const since = sittings[0]?.startedAt ?? run.startedAt;

  const version = await findOpenedVersion({ lessonId, since, userId });

  const [answers, lesson] = await Promise.all([
    loadProgressAnswers({ lessonId, since, userId, version }),
    findPlayableLessonRow({ lessonId, userId, version }),
  ]);

  return lesson
    ? {
        answers,
        optionalStepIds: [
          ...getLatePictureStepIds({ rows: lesson.steps, runStartedAt: run.startedAt }),
        ],
      }
    : null;
}

async function readRun({
  lessonId,
  run,
  userId,
}: {
  lessonId: string;
  run: LearningEvent;
  userId: string;
}): Promise<LibraryLessonRun | null> {
  const [progress, hyperdrive, support] = await Promise.all([
    loadRunProgress({ lessonId, run, userId }),
    getRunHyperdrive({ lessonId, run, studySessionId: getRunStudySessionId(run), userId }),
    getRunLessonSupport(run) ?? loadLessonSupport({ lessonId, userId }),
  ]);

  return progress
    ? { ...progress, hyperdrive, runId: run.id, startedAt: run.startedAt.toISOString(), support }
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

  if (input.runId) {
    const requested = await findLessonRun({ lessonId, runId: input.runId, userId });

    const run =
      requested && requested.endedAt === null
        ? await readRun({ lessonId, run: requested, userId })
        : null;

    return run ? { run, status: "started" } : { status: "notFound" };
  }

  const lesson = await findStartableLesson({ lessonId, userId });

  if (!lesson) {
    return { status: "notFound" };
  }

  // Save today before starting so a standalone lesson can settle its existing block.
  await saveDayBeforeActivity({ timeZone: input.timeZone, userId });

  // Quick explanations already claimed their own allowance and must not consume a lesson allowance too.
  if (!isOwnExplanation(lesson)) {
    if (await isLessonPlusOnly({ lessonId: lesson.id, timeZone: input.timeZone, userId })) {
      return { status: "plusRequired" };
    }

    const usage = await claimUsage({ kind: "lessonStart", targetId: lesson.id });

    if (usage.status !== "allowed") {
      return usage;
    }
  }

  const studySessionId = await findLessonStudySessionId({
    lessonId: lesson.id,
    studySessionId: input.studySessionId,
    userId,
  });

  const { isNew, run } = await openLessonRun({
    lesson,
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

  const started = await readRun({ lessonId: lesson.id, run, userId });
  return started ? { run: started, status: "started" } : { status: "notFound" };
}
