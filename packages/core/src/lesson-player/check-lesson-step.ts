import "server-only";
import { type StepKind, type TransactionClient, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import {
  afterLanguageStepEvidence,
  loadLanguageStepEvidence,
  writeLanguageStepEvidence,
} from "../language/levels/record-language-evidence";
import {
  findSavedAttempt,
  getAnswerAttemptId,
  recordAnswerOnce,
} from "../learner/_utils/answer-once";
import { getLearnerTimeZone } from "../learner/_utils/goal-time-zone";
import { canGradeWithModel } from "../learner/_utils/model-grading";
import { scheduleMistakeCause } from "../mistakes/resolve-mistake-cause";
import { getSession } from "../users/get-session";
import {
  type ComesBackInput,
  checkSaved,
  checkWithoutRecording,
  getComesBack,
  toCheckResult,
} from "./_utils/check-results";
import { type LessonAnswerVerdict, gradeLessonAnswer } from "./_utils/grade-lesson-answer";
import { findPlayableStepRow, getAnswerSkillId, isOwnExplanation } from "./_utils/lesson-rows";
import {
  findLessonRun,
  getRunStudySessionId,
  hasAnswerSince,
  lockOpenRun,
} from "./_utils/lesson-runs";
import { loadPlayableSteps } from "./_utils/load-playable-steps";
import { getStepQuestion } from "./_utils/step-question";
import {
  type LessonStepAnswer,
  type LessonStepCheckInput,
  type LessonStepCheckResult,
} from "./contract";
import { isAnswerableStep } from "./lesson-run";

/**
 * The first answer, the question coming back at the end of the lesson and one retried request.
 * More answers to one screen in one run come from a client looping or the lesson open in another
 * tab: they're graded by code and not recorded.
 */
const MAX_ANSWERS_PER_STEP_IN_RUN = 3;

/** How long a screen should take to answer, so a slow answer rates Hard instead of Good. */
const EXPECTED_ANSWER_MS: Partial<Record<StepKind, number>> = {
  activity: 45_000,
  challenge: 300_000,
  spokenAnswer: 30_000,
  typedAnswer: 60_000,
};

export type LessonStepCheckOutcome =
  | { result: LessonStepCheckResult; status: "checked" }
  | { status: "invalid" }
  | { status: "notFound" }
  | { status: "runEnded" }
  | { status: "unauthorized" };

async function countRunAnswers({
  startedAt,
  stepId,
  userId,
}: {
  startedAt: Date;
  stepId: string;
  userId: string;
}): Promise<number> {
  return prisma.attempt.count({ where: { answeredAt: { gte: startedAt }, stepId, userId } });
}

/**
 * The kind of screen the learner actually answered: a spoken screen swapped for its listening
 * exercise ("I can't talk now") counts as listening, for the notebook and the listening level.
 */
function getAnsweredKind({ answer, kind }: { answer: LessonStepAnswer; kind: StepKind }): StepKind {
  return kind === "spokenAnswer" && answer.kind === "listening" ? "listening" : kind;
}

/**
 * Grades the answer. Only a recorded typed answer asks a model, within the day's model-graded
 * answers to the screen; past those, or past the run's cap, code grades it.
 */
async function gradeRunAnswer({
  answer,
  isRecorded,
  lesson,
  step,
  userId,
}: Omit<Parameters<typeof gradeLessonAnswer>[0], "useModel"> & { isRecorded: boolean }) {
  const useModel =
    step.kind === "typedAnswer" &&
    isRecorded &&
    (await canGradeWithModel({ question: { stepId: step.id }, userId }));

  return gradeLessonAnswer({ answer, lesson, step, useModel, userId });
}

type PlayableStepRow = NonNullable<Awaited<ReturnType<typeof findPlayableStepRow>>>;

/**
 * Records a graded answer as learning, once under its id, with its language evidence in the same
 * transaction, and says what it saved and when its idea comes back. It's recorded as answered when
 * it arrived (`receivedAt`), and not at all once its run finished, nor when an answer to the screen
 * that arrived after it was recorded first: a grade the screen stopped waiting for doesn't count
 * after the answer the learner checked again, and one that's saved first stays the first answer.
 */
async function recordCheck({
  attemptId,
  comesBack,
  input,
  receivedAt,
  row,
  run,
  skillId,
  step,
  verdict,
}: {
  attemptId?: string;
  comesBack: ComesBackInput;
  input: LessonStepCheckInput;
  receivedAt: Date;
  row: PlayableStepRow;
  run: NonNullable<Awaited<ReturnType<typeof findLessonRun>>>;
  skillId: string | null;
  step: Parameters<typeof getStepQuestion>[0];
  verdict: LessonAnswerVerdict;
}): Promise<LessonStepCheckOutcome> {
  const questionText = getStepQuestion(step);
  const answeredKind = getAnsweredKind({ answer: input.answer, kind: row.kind });

  const evidence = await loadLanguageStepEvidence({
    isCorrect: verdict.isCorrect,
    lesson: row.lesson,
    step: { ...row, kind: answeredKind },
    userId: comesBack.userId,
  });

  const outcome = await recordAnswerOnce({
    answer: {
      answer: input.answer,
      // When it arrived, not when its grade was saved: answers to a screen keep the order they
      // were sent in, however long each one's grade took.
      answeredAt: receivedAt,
      attemptId,
      graded: {
        durationMs: input.durationMs,
        expectedDurationMs: EXPECTED_ANSWER_MS[answeredKind],
        isCorrect: verdict.isCorrect,
        score: verdict.score,
        usedHint: input.usedHelp ?? false,
      },
      itemId: row.itemId,
      language: row.lesson.language,
      mistake: questionText
        ? {
            questionText,
            snapshot: {
              answer: verdict.answerText,
              correctAnswer: verdict.correctAnswer,
              explanation: verdict.feedback,
              format: answeredKind,
              question: questionText,
            },
          }
        : null,
      purpose: "learning",
      skillId,
      stepId: row.id,
      studySessionId: getRunStudySessionId(run),
      targetLanguage: row.lesson.targetLanguage,
      timeZone: comesBack.timeZone,
      userId: comesBack.userId,
    },
    refuse: async (transaction: TransactionClient) => {
      if (!(await lockOpenRun(transaction, run.id))) {
        return "runEnded";
      }

      const overtaken = await hasAnswerSince(transaction, {
        attemptId,
        since: receivedAt,
        stepId: row.id,
        userId: comesBack.userId,
      });

      return overtaken ? "overtaken" : null;
    },
    withAnswer: evidence
      ? (transaction) => writeLanguageStepEvidence(transaction, evidence)
      : undefined,
  });

  if (outcome.status === "refused") {
    return outcome.refusal === "runEnded"
      ? { status: "runEnded" }
      : {
          result: await checkWithoutRecording({ ...comesBack, skillId, verdict }),
          status: "checked",
        };
  }

  // Sent twice at once: the other request recorded it, with its own grade.
  if (outcome.status === "saved") {
    const result = await checkSaved({
      ...comesBack,
      fromCode: row.kind !== "typedAnswer",
      hasQuestion: questionText !== null,
      saved: outcome.saved,
      skillId,
      verdict,
    });

    return { result, status: "checked" };
  }

  const { recorded } = outcome;

  scheduleMistakeCause(recorded.causeRequest);

  if (evidence) {
    afterLanguageStepEvidence(evidence);
  }

  return {
    result: toCheckResult({
      nextReviewAt: await getComesBack({
        ...comesBack,
        ownDue: recorded.learnerSkill?.due ?? null,
      }),
      savedMistake: recorded.mistake !== null,
      verdict,
    }),
    status: "checked",
  };
}

/**
 * Grades one answer to a lesson screen on the server and records it as learning: the attempt on
 * the learner's day, the review of the skill it trains and, when wrong, an entry in the mistakes
 * notebook. Checks, activities and language exercises use the code the player ran; typed answers
 * use the grader (not counted as small AI help: grading must stay right, and the plan's lesson
 * caps bound it), or code alone past a few graded answers to the screen a day, where an answer
 * code doesn't recognize is shown as not checked and isn't recorded. Answers count toward an open
 * run of the screen's lesson, and toward its session when the run was started from one; one
 * finished while the answer was graded isn't recorded. A screen answered more often than a run
 * allows is graded by code and not recorded. An answer sent with its `attemptId` is recorded once,
 * and sent again it gets what it saved.
 */
export async function checkLessonStep({
  input,
  stepId,
}: {
  input: LessonStepCheckInput;
  stepId: string;
}): Promise<LessonStepCheckOutcome> {
  // When the answer arrived: a later answer to the screen recorded before it is newer (`recordCheck`).
  const receivedAt = new Date();
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!isUuid(stepId)) {
    return { status: "notFound" };
  }

  const userId = session.user.id;
  const row = await findPlayableStepRow({ stepId, userId });
  const run = row && (await findLessonRun({ lessonId: row.lessonId, runId: input.runId, userId }));

  if (!row || !run) {
    return { status: "notFound" };
  }

  const [step] = await loadPlayableSteps({ lesson: row.lesson, rows: [row] });

  if (!step || !isAnswerableStep(step)) {
    return { status: "invalid" };
  }

  const attemptId = input.attemptId
    ? getAnswerAttemptId({ key: input.attemptId, questionId: row.id, userId })
    : undefined;

  const saved = attemptId ? await findSavedAttempt({ attemptId, userId }) : null;

  // An answer saved before its run finished still gets what it saved when it's sent again.
  if (run.endedAt && !saved) {
    return { status: "runEnded" };
  }

  // An answer sent again is graded by code alone: it was graded and recorded the first time.
  const isRecorded =
    !saved &&
    (await countRunAnswers({ startedAt: run.startedAt, stepId: row.id, userId })) <
      MAX_ANSWERS_PER_STEP_IN_RUN;

  const verdict = await gradeRunAnswer({
    answer: input.answer,
    isRecorded,
    lesson: row.lesson,
    step,
    userId,
  });

  if (!verdict) {
    return { status: "invalid" };
  }

  const skillId = getAnswerSkillId({
    lessonSkillIds: row.lesson.skills.map((skill) => skill.skillId),
    stepSkillId: row.skillId,
  });

  const timeZone = await getLearnerTimeZone({ timeZone: input.timeZone, userId });

  const comesBack: ComesBackInput = {
    explanation: isOwnExplanation(row.lesson),
    lessonId: row.lessonId,
    runStartedAt: run.startedAt,
    timeZone,
    userId,
  };

  if (saved) {
    return {
      result: await checkSaved({
        ...comesBack,
        fromCode: true,
        hasQuestion: getStepQuestion(step) !== null,
        saved,
        skillId,
        verdict,
      }),
      status: "checked",
    };
  }

  if (!isRecorded || !verdict.checked) {
    return {
      result: await checkWithoutRecording({ ...comesBack, skillId, verdict }),
      status: "checked",
    };
  }

  return recordCheck({ attemptId, comesBack, input, receivedAt, row, run, skillId, step, verdict });
}
