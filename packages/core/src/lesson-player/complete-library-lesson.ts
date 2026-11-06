import "server-only";
import { type LearningEvent, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getLearnerTimeZone } from "../learner/_utils/goal-time-zone";
import {
  loadLessonPlanSkillIds,
  loadLessonReviewSkillIds,
} from "../learner/_utils/lesson-plan-skills";
import { scoreLessonAnswers } from "../sessions/score-lesson-answers";
import { getSession } from "../users/get-session";
import { loadCompletionSteps } from "./_utils/completion-steps";
import { announceFinishedRun, finishLessonRun } from "./_utils/finish-lesson-run";
import { isOwnExplanation } from "./_utils/lesson-rows";
import { findLessonRun, toSittings } from "./_utils/lesson-runs";
import {
  type LessonProgress,
  type RunCompletion,
  withStudyBlock,
} from "./_utils/lesson-study-block";
import { loadPlayedLesson } from "./_utils/load-played-lesson";
import { getNextReviewAt, loadLessonAttempts } from "./_utils/plan-skill-review";
import { type LibraryLessonCompletionInput } from "./completion-input-contract";
import { type LibraryLessonCompletion } from "./contract";
import { tallyLessonRun } from "./lesson-run";

export type LibraryLessonCompletionOutcome =
  | { completion: LibraryLessonCompletion; status: "completed" }
  | { status: "invalid" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** Retries must use the saved outcome without counting the run twice. */
async function readFinishedRun({
  run,
  skillIds,
  userId,
}: {
  run: LearningEvent;
  skillIds: string[];
  userId: string;
}): Promise<RunCompletion> {
  const [progress, nextReviewAt] = await Promise.all([
    prisma.userProgress.findUnique({ select: { totalBrainPower: true }, where: { userId } }),
    getNextReviewAt({ skillIds, userId }),
  ]);

  return {
    brainPower: run.brainPower,
    correctCount: run.correctAnswers,
    energyDelta: run.energyDelta,
    incorrectCount: run.incorrectAnswers,
    isFirstCompletion: run.kind === "lesson",
    nextReviewAt,
    seconds: run.seconds,
    totalBrainPower: Number(progress?.totalBrainPower ?? 0),
  };
}

/** Requires all answerable screens completed or a valid skip; late numbered-picture screens are optional. Retries return the saved outcome without recounting. */
export async function completeLibraryLesson({
  input,
  lessonId,
}: {
  input: LibraryLessonCompletionInput;
  lessonId: string;
}): Promise<LibraryLessonCompletionOutcome> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!isUuid(lessonId) || !isUuid(input.runId)) {
    return { status: "notFound" };
  }

  const userId = session.user.id;

  const run = await findLessonRun({ lessonId, runId: input.runId, userId });

  const { lesson, sittings, skippedWritingStepIds } = run
    ? await loadPlayedLesson({
        lessonId,
        run,
        skippedWritingStepIds: input.skippedWritingStepIds,
        userId,
      })
    : { lesson: null, sittings: [], skippedWritingStepIds: [] };

  if (!lesson || !run) {
    return { status: "notFound" };
  }

  const completionSteps = await loadCompletionSteps({
    lesson,
    runStartedAt: run.startedAt,
    skippedWritingStepIds,
    userId,
  });

  if (!completionSteps) {
    return { status: "invalid" };
  }

  const [skillIds, timeZone] = await Promise.all([
    isOwnExplanation(lesson)
      ? []
      : loadLessonReviewSkillIds({
          lessonId,
          ownSkillIds: [
            ...new Set([
              ...lesson.skills.map((skill) => skill.skillId),
              ...completionSteps.steps.flatMap((step) => (step.skillId ? [step.skillId] : [])),
            ]),
          ],
          userId,
        }),
    getLearnerTimeZone({ timeZone: input.timeZone, userId }),
  ]);

  const settle = (completion: RunCompletion, progress?: LessonProgress) =>
    withStudyBlock({ completion, progress, runId: run.id, timeZone, userId });

  if (run.endedAt) {
    return {
      completion: await settle(await readFinishedRun({ run, skillIds, userId })),
      status: "completed",
    };
  }

  const attempts = await loadLessonAttempts({ sittings, steps: completionSteps.steps, userId });

  const tally = tallyLessonRun({
    attempts,
    optionalStepIds: completionSteps.optionalStepIds,
    steps: completionSteps.steps,
  });

  if (!tally.isComplete) {
    return { status: "invalid" };
  }

  const { brainPower: answerPoints } = await scoreLessonAnswers({
    answers: attempts,
    sittings: toSittings(sittings),
    userId,
  });

  // Resolve membership before taking progress/run locks; the transaction uses only its own client.
  const planSkillIds =
    skillIds.length > 0
      ? await loadLessonPlanSkillIds({ lessonIds: [lessonId], userId })
      : new Map<string, string[]>();

  const finished = await finishLessonRun({
    answerPoints,
    answeredCount: attempts.length,
    answers: attempts,
    lessonId,
    planSkillIds: planSkillIds.get(lessonId) ?? [],
    run,
    skillIds,
    skippedWritingStepIds,
    tally,
    timeZone,
    userId,
  });

  announceFinishedRun({ finished, lessonId, run, userId });

  if (!finished) {
    const closedRun = await prisma.learningEvent.findUniqueOrThrow({ where: { id: run.id } });

    return {
      completion: await settle(await readFinishedRun({ run: closedRun, skillIds, userId })),
      status: "completed",
    };
  }

  return { completion: await settle(finished.completion, finished.progress), status: "completed" };
}
