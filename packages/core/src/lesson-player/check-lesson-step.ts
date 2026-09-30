import "server-only";
import { type StepKind, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { claimAssist } from "../entitlements/claim-usage";
import { recordLanguageStepEvidence } from "../language/levels/record-language-evidence";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { type RecordedLearnerAnswer, recordLearnerAnswer } from "../learner/record-learner-answer";
import { scheduleMistakeCause } from "../mistakes/resolve-mistake-cause";
import { getSession } from "../users/get-session";
import { type LessonAnswerVerdict, gradeLessonAnswer } from "./_utils/grade-lesson-answer";
import { findPlayableStepRow, getAnswerSkillId } from "./_utils/lesson-rows";
import { findLessonRun, getRunStudySessionId } from "./_utils/lesson-runs";
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
 * More answers to one screen in one run are a client looping, which would also loop the grader.
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
  | { status: "tooManyAnswers" }
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
  recorded,
  verdict,
}: {
  recorded: RecordedLearnerAnswer;
  verdict: LessonAnswerVerdict;
}): LessonStepCheckResult {
  return {
    correctAnswer: verdict.correctAnswer,
    feedback: verdict.feedback,
    isCorrect: verdict.isCorrect,
    keyPoints: verdict.keyPoints,
    nextReviewAt: recorded.learnerSkill?.due?.toISOString() ?? null,
    savedMistake: recorded.mistake !== null,
    score: verdict.score,
    spelling: verdict.spelling,
  };
}

/**
 * Grades one answer to a lesson screen on the server and records it as learning: the attempt on
 * the learner's day, the review of the skill it trains and, when wrong, an entry in the mistakes
 * notebook. Checks, activities and language exercises use the code the player ran; typed answers
 * use the grader, claimed as small AI help, or code alone once that help is used up. Answers count toward an open run of the screen's lesson, and toward its session
 * when the run was started from one.
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

  const answers = await countRunAnswers({ startedAt: run.startedAt, stepId: row.id, userId });

  if (answers >= MAX_ANSWERS_PER_STEP_IN_RUN) {
    return { status: "tooManyAnswers" };
  }

  // Only a typed answer asks a model; once the learner's small AI help is used up, code grades it.
  const usage = step.kind === "typedAnswer" ? await claimAssist() : null;
  const useModel = usage?.status === "allowed";

  const verdict = await gradeLessonAnswer({
    answer: input.answer,
    lesson: row.lesson,
    step,
    useModel,
    userId,
  });

  if (!verdict) {
    return { status: "invalid" };
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
    skillId: getAnswerSkillId({
      lessonSkillIds: row.lesson.skills.map((skill) => skill.skillId),
      stepSkillId: row.skillId,
    }),
    stepId: row.id,
    studySessionId: getRunStudySessionId(run),
    targetLanguage: row.lesson.targetLanguage,
    timeZone: getAnswerTimeZone({ goal: null, timeZone: input.timeZone }),
    userId,
  });

  scheduleMistakeCause(recorded.causeRequest);

  await recordLanguageStepEvidence({
    isCorrect: verdict.isCorrect,
    lesson: row.lesson,
    step: { ...row, kind: answeredKind },
    userId,
  });

  return { result: toCheckResult({ recorded, verdict }), status: "checked" };
}
