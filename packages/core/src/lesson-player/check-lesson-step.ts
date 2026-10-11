import "server-only";
import { type StepKind, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { recordLanguageStepEvidence } from "../language/levels/record-language-evidence";
import { getLearnerTimeZone } from "../learner/_utils/goal-time-zone";
import { canGradeWithModel } from "../learner/_utils/model-grading";
import { recordLearnerAnswer } from "../learner/record-learner-answer";
import { scheduleMistakeCause } from "../mistakes/resolve-mistake-cause";
import { getSession } from "../users/get-session";
import { type LessonAnswerVerdict, gradeLessonAnswer } from "./_utils/grade-lesson-answer";
import { findPlayableStepRow, getAnswerSkillId, isOwnExplanation } from "./_utils/lesson-rows";
import { findLessonRun, getRunStudySessionId } from "./_utils/lesson-runs";
import { loadPlayableSteps } from "./_utils/load-playable-steps";
import { getScreenComesBack } from "./_utils/plan-skill-review";
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

function toCheckResult({
  nextReviewAt,
  savedMistake,
  verdict,
}: {
  nextReviewAt: Date | null;
  savedMistake: boolean;
  verdict: LessonAnswerVerdict;
}): LessonStepCheckResult {
  return {
    checked: verdict.checked,
    correctAnswer: verdict.correctAnswer,
    corrections: verdict.corrections,
    feedback: verdict.feedback,
    isCorrect: verdict.isCorrect,
    keyPoints: verdict.keyPoints,
    nextReviewAt: nextReviewAt?.toISOString() ?? null,
    savedMistake,
    score: verdict.score,
    spelling: verdict.spelling,
  };
}

type ComesBackInput = Omit<Parameters<typeof getScreenComesBack>[0], "ownDue"> & {
  explanation: boolean;
};

/**
 * When the screen's idea comes back (see `getScreenComesBack`). A quick explanation never comes
 * back in a review (reviews come with a study plan's sessions, which explanations aren't part of),
 * so its screens don't say when their skill does.
 */
function getComesBack({
  explanation,
  ownDue,
  ...input
}: ComesBackInput & { ownDue: Date | null }): Promise<Date | null> | null {
  return explanation ? null : getScreenComesBack({ ...input, ownDue });
}

/**
 * An answer past the run's cap, or a written one nothing checked, isn't recorded: the verdict,
 * with when the idea already comes back and no new mistake.
 */
async function checkWithoutRecording({
  skillId,
  verdict,
  ...comesBack
}: ComesBackInput & {
  skillId: string | null;
  verdict: LessonAnswerVerdict;
}): Promise<LessonStepCheckOutcome> {
  const learnerSkill =
    skillId && !comesBack.explanation
      ? await prisma.learnerSkill.findFirst({
          select: { due: true },
          where: { skillId, userId: comesBack.userId },
        })
      : null;

  return {
    result: toCheckResult({
      nextReviewAt: await getComesBack({ ...comesBack, ownDue: learnerSkill?.due ?? null }),
      savedMistake: false,
      verdict,
    }),
    status: "checked",
  };
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

/**
 * Grades one answer to a lesson screen on the server and records it as learning: the attempt on
 * the learner's day, the review of the skill it trains and, when wrong, an entry in the mistakes
 * notebook. Checks, activities and language exercises use the code the player ran; typed answers
 * use the grader (not counted as small AI help: grading must stay right, and the plan's lesson
 * caps bound it), or code alone past a few graded answers to the screen a day, where an answer
 * code doesn't recognize is shown as not checked and isn't recorded. Answers count toward an open
 * run of the screen's lesson, and toward its session when the run was started from one. A screen
 * answered more often than a run allows is graded by code and not recorded.
 */
export async function checkLessonStep({
  input,
  stepId,
}: {
  input: LessonStepCheckInput;
  stepId: string;
}): Promise<LessonStepCheckOutcome> {
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

  if (run.endedAt) {
    return { status: "runEnded" };
  }

  const [step] = await loadPlayableSteps({ lesson: row.lesson, rows: [row] });

  if (!step || !isAnswerableStep(step)) {
    return { status: "invalid" };
  }

  const isRecorded =
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

  if (!isRecorded || !verdict.checked) {
    return checkWithoutRecording({ ...comesBack, skillId, verdict });
  }

  const questionText = getStepQuestion(step);
  const answeredKind = getAnsweredKind({ answer: input.answer, kind: row.kind });

  const recorded = await recordLearnerAnswer({
    answer: input.answer,
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
    timeZone,
    userId,
  });

  scheduleMistakeCause(recorded.causeRequest);

  await recordLanguageStepEvidence({
    isCorrect: verdict.isCorrect,
    lesson: row.lesson,
    step: { ...row, kind: answeredKind },
    userId,
  });

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
