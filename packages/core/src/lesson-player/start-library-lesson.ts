import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { claimUsage } from "../entitlements/claim-usage";
import { type UsageDecision } from "../entitlements/contract";
import { findActiveGoalId } from "../goals/_utils/goal-view";
import { getLearnerTimeZone } from "../learner/_utils/goal-time-zone";
import { isLessonPlusOnly } from "../sessions/_utils/plus-only-lessons";
import { startLearningEvent } from "../stats/record-learning-event";
import { getSession } from "../users/get-session";
import { trackLessonStarted } from "./_utils/lesson-events";
import { findLessonStudySessionId, getRunHyperdrive } from "./_utils/lesson-hyperdrive";
import { findStartableLesson, isOwnExplanation } from "./_utils/lesson-rows";
import {
  findResumableRun,
  getRunStudySessionId,
  loadProgressAnswers,
  loadProgressRuns,
  lockLessonRuns,
} from "./_utils/lesson-runs";
import { loadLessonSupport } from "./_utils/lesson-support";
import { type LibraryLessonRun, type LibraryLessonStartInput } from "./contract";

/** How the ledger labels a lesson run, so admin stats can tell it from checkpoints and practice. */
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

/**
 * Opens the run in the ledger with `endedAt` null, so a lesson started and never finished still
 * counts against the completion rate. The goal is the one the tabs show, and a lesson played as a
 * session block keeps the session, so its answers count toward it.
 */
async function openLessonRun({ lesson, studySessionId, timeZone, userId }: RunSource) {
  const goalId = await findActiveGoalId(userId);

  return prisma.$transaction(async (tx) => {
    await lockLessonRuns(tx, { lessonId: lesson.id, userId });

    const now = new Date();
    const resumable = await findResumableRun(tx, { lessonId: lesson.id, now, userId });

    if (resumable) {
      return { isNew: false, run: resumable };
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

    return { isNew: true, run };
  });
}

/** The lesson's answers this run continues from: its own and its unfinished earlier sittings'. */
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

  return loadProgressAnswers({ lessonId, since, userId });
}

/**
 * Starts a Library lesson for the learner or guest in the session. Starting counts against the
 * allowance once per lesson (restarts are free), so the outcome can ask the learner to slow down,
 * sign up or subscribe instead. A start within half an hour of another one (a double mount or a
 * reload) resumes the same run; later, a new run opens for this sitting. Either way the run comes
 * with the lesson's answers so far (`answers`, including sittings left unfinished in the last
 * week), so the learner continues where they left off; answers and the completion refer to its id.
 * The run says where Hyperdrive stood when it started, continuing this session's streak (never
 * another day's), and how the lesson opens for this learner (`support`). Only a new run counts as
 * "Lesson Started". A free exam plan past its first week opens its new lessons with Plus only.
 */
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

  if (!isUuid(lessonId)) {
    return { status: "notFound" };
  }

  const userId = session.user.id;
  const lesson = await findStartableLesson({ lessonId, userId });

  if (!lesson) {
    return { status: "notFound" };
  }

  /**
   * A quick explanation is the front door: asking for it already claimed its own fair-use
   * allowance, so playing it never takes one of the learner's lessons. The grader still checks only
   * a few typed answers to each screen a day (`canGradeWithModel`).
   */
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

  const [answers, hyperdrive, support] = await Promise.all([
    loadRunProgress({ lessonId: lesson.id, run, userId }),
    getRunHyperdrive({
      lessonId: lesson.id,
      run,
      studySessionId: getRunStudySessionId(run),
      userId,
    }),
    loadLessonSupport({ lessonId: lesson.id, userId }),
  ]);

  return {
    run: { answers, hyperdrive, runId: run.id, startedAt: run.startedAt.toISOString(), support },
    status: "started",
  };
}
