import "server-only";
import { type Mistake, prisma } from "@zoonk/db";
import { claimUsage } from "../entitlements/claim-usage";
import {
  loadLanguageStepEvidence,
  writeLanguageStepEvidence,
} from "../language/levels/record-language-evidence";
import { schedulePronunciationReviews } from "../language/pronunciation/schedule-pronunciation-reviews";
import { getAnswerAttemptId, recordAnswerOnce } from "../learner/_utils/answer-once";
import { getLearnerTimeZone } from "../learner/_utils/goal-time-zone";
import { toCheckResult } from "../lesson-player/_utils/check-results";
import { type PlayableLibraryStep } from "../lesson-player/playable-lesson";
import {
  SPOKEN_EVIDENCE_SCORE,
  gradeSpokenRecording,
} from "../library/language/_utils/grade-spoken-recording";
import {
  type SpokenAudio,
  isValidSpokenAudio,
} from "../library/language/_utils/hear-spoken-sentence";
import {
  type GradeSpokenAnswerResult,
  type SpokenAnswerFields,
  type SpokenAnswerGrade,
  spokenAnswerGradeSchema,
} from "../library/language/spoken-answer-contract";
import { saveDayBeforeActivity } from "../sessions/ensure-study-session";
import { getSession } from "../users/get-session";
import { runMistakeGrade } from "./_utils/mistake-grade";
import { finishPracticeAnswer } from "./_utils/practice-feedback";
import { applyDrillRules } from "./drill-answer";
import { getDrillKind, getDrillTimeLimitSeconds } from "./mistake-drills";
import { type MistakeLessonReplay, loadMistakeReplay } from "./mistake-replay";
import { readMistakeSnapshot } from "./mistake-snapshot";

const recordingGradeSchema = spokenAnswerGradeSchema.omit({ attemptId: true, practice: true });

export async function gradeSpokenMistake({
  audio,
  fields,
  stepId,
}: {
  audio: SpokenAudio;
  fields: SpokenAnswerFields;
  stepId: string;
}): Promise<GradeSpokenAnswerResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!fields.mistakeId || !fields.attemptId) {
    return { status: "notFound" };
  }

  const userId = session.user.id;
  const mistake = await prisma.mistake.findFirst({ where: { id: fields.mistakeId, userId } });
  const replay = mistake ? await loadMistakeReplay({ mistake, userId }) : null;

  if (
    !mistake ||
    replay?.kind !== "lesson" ||
    replay.lesson.step.kind !== "spokenAnswer" ||
    replay.lesson.step.id !== stepId
  ) {
    return { status: "notFound" };
  }

  if (!(await isValidSpokenAudio(audio))) {
    return { status: "invalidAudio" };
  }

  const { lesson } = replay;
  const step = replay.lesson.step;

  const attemptId = getAnswerAttemptId({
    key: fields.attemptId,
    questionId: `spoken:${mistake.id}`,
    userId,
  });

  const usage = await claimUsage({ kind: "assist", targetId: attemptId });

  if (usage.status !== "allowed") {
    return usage;
  }

  const graded = await runMistakeGrade({
    attemptId,
    cacheWithoutModelClaim: true,
    grade: async () => ({
      grade: await gradeSpokenRecording({
        audio,
        cacheExplanation: false,
        step: {
          id: step.id,
          learnerLanguage: lesson.language,
          targetLanguage: step.content.language,
          targetText: step.content.targetText,
        },
        userId,
      }),
    }),
    questionId: step.id,
    userId,
  });

  if (graded.status === "retryable") {
    return { retryAfterSeconds: 1, status: "slowDown" };
  }

  if (graded.result.grade === null) {
    return { status: "noSpeech" };
  }

  const grade = recordingGradeSchema.parse(graded.result.grade);
  return recordSpokenPractice({ attemptId, fields, grade, lesson, mistake, step, userId });
}

async function recordSpokenPractice({
  attemptId,
  fields,
  grade,
  lesson,
  mistake,
  step,
  userId,
}: {
  attemptId: string;
  fields: SpokenAnswerFields;
  grade: Omit<SpokenAnswerGrade, "attemptId" | "practice">;
  lesson: MistakeLessonReplay;
  mistake: Mistake;
  step: Extract<PlayableLibraryStep, { kind: "spokenAnswer" }>;
  userId: string;
}): Promise<GradeSpokenAnswerResult> {
  const kind = getDrillKind(mistake.cause);

  const drilled = applyDrillRules({
    drill: { kind, timeLimitSeconds: getDrillTimeLimitSeconds(kind) },
    durationMs: fields.practiceDurationMs ?? fields.durationMs,
    isCorrect: grade.isCorrect,
    misconception: null,
  });

  const timeZone = await getLearnerTimeZone({ timeZone: fields.timeZone, userId });
  await saveDayBeforeActivity({ goalId: fields.goalId, timeZone, userId });

  const evidence = await loadLanguageStepEvidence({
    isCorrect: grade.score >= SPOKEN_EVIDENCE_SCORE,
    lesson: { level: lesson.level, targetLanguage: lesson.targetLanguage },
    step: { kind: "spokenAnswer", wordId: null },
    userId,
  });

  const outcome = await recordAnswerOnce({
    answer: {
      answer: { kind: "spoken", practiceMistakeId: mistake.id, transcript: grade.transcript },
      attemptId,
      graded: {
        durationMs: fields.practiceDurationMs ?? fields.durationMs,
        isCorrect: drilled.isCorrect,
        score: grade.score,
      },
      language: lesson.language,
      mistake: {
        questionText: readMistakeSnapshot(mistake.snapshot).question,
        snapshot: {
          ...readMistakeSnapshot(mistake.snapshot),
          answer: grade.transcript,
          correctAnswer: step.content.targetText,
          explanation: grade.explanation,
          replay: { kind: "lesson", lesson },
        },
        timeLimitMs: drilled.timeLimitMs,
      },
      practiceQuestion: { id: step.id, kind: "lesson" },
      practicedMistakeId: mistake.id,
      purpose: "learning",
      skillId: mistake.skillId,
      stepId: mistake.stepId,
      targetLanguage: lesson.targetLanguage,
      timeZone,
      userId,
    },
    withAnswer: evidence
      ? (transaction) => writeLanguageStepEvidence(transaction, evidence)
      : undefined,
  });

  if (outcome.status === "recorded") {
    await schedulePronunciationReviews({
      targetLanguage: step.content.language,
      timeZone,
      userId,
      userLanguage: lesson.language,
      words: grade.wordsToPractice.map((word) => word.text),
    });
  }

  const isCorrect =
    outcome.status === "saved" ? outcome.saved.isCorrect : outcome.recorded.attempt.isCorrect;

  const lessonResult = toCheckResult({
    nextReviewAt: null,
    savedMistake: !isCorrect,
    verdict: {
      answerText: grade.transcript,
      checked: true,
      correctAnswer: isCorrect ? null : step.content.targetText,
      corrections: [],
      expected: null,
      feedback: grade.explanation,
      isCorrect,
      keyPoints: null,
      score: grade.score,
      spelling: null,
    },
  });

  const practice = await finishPracticeAnswer({
    answerId: attemptId,
    feedback: {
      correctAnswer: null,
      explanation: grade.explanation,
      isCorrect,
      lessonResult,
      trap: drilled.trap,
      workedSteps: [],
    },
    input: { run: { answerIds: fields.answerIds ?? [], goalId: fields.goalId }, timeZone },
    mistakeId: mistake.id,
  });

  return { grade: { ...grade, attemptId, practice }, status: "graded" };
}
