import "server-only";
import { type Mistake, prisma } from "@zoonk/db";
import { claimUsage } from "../entitlements/claim-usage";
import {
  loadLanguageStepEvidence,
  writeLanguageStepEvidence,
} from "../language/levels/record-language-evidence";
import { schedulePronunciationReviews } from "../language/pronunciation/schedule-pronunciation-reviews";
import {
  findSavedAttempt,
  getAnswerAttemptId,
  recordAnswerOnce,
} from "../learner/_utils/answer-once";
import { runAnswerGrade } from "../learner/_utils/run-answer-grade";
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
} from "../library/language/spoken-answer-contract";
import { saveDayBeforeActivity } from "../sessions/ensure-study-session";
import { getSession } from "../users/get-session";
import { getPracticeAnswerScope } from "./_utils/practice-answer-scope";
import { refuseClosedMistake } from "./_utils/practice-claim";
import { countRunSoFar, finishPracticeAnswer } from "./_utils/practice-feedback";
import {
  type RecordingInput,
  recordingGradeSchema,
  replaySpokenPractice,
} from "./_utils/spoken-practice-grade";
import { visibleMistakeWhere } from "./_utils/visible-mistake";
import { applyDrillRules } from "./drill-answer";
import { getDrillKind, getDrillTimeLimitSeconds } from "./mistake-drills";
import { type MistakeLessonReplay, loadMistakeReplay } from "./mistake-replay";
import { readMistakeSnapshot } from "./mistake-snapshot";

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

  const mistake = await prisma.mistake.findFirst({
    where: { ...visibleMistakeWhere, id: fields.mistakeId, userId },
  });

  if (!mistake) {
    return { status: "notFound" };
  }

  const attemptId = getAnswerAttemptId({
    key: fields.attemptId,
    questionId: `spoken:${mistake.id}`,
    userId,
  });

  const [saved, scope] = await Promise.all([
    findSavedAttempt({ attemptId, userId }),
    getPracticeAnswerScope({
      blockId: fields.blockId,
      goalId: fields.goalId,
      mistakeId: mistake.id,
      mockId: fields.mockId,
      timeZone: fields.timeZone,
      userId,
    }),
  ]);

  if (!scope) {
    return { status: "notFound" };
  }

  const input = {
    run: {
      answerIds: fields.answerIds ?? [],
      blockId: fields.blockId,
      goalId: scope.goalId,
      mockId: fields.mockId,
    },
    timeZone: scope.timeZone,
  };

  const recorded = saved
    ? await replaySpokenPractice({ attempt: saved, input, mistakeId: mistake.id })
    : null;

  if (recorded) {
    return recorded;
  }

  const replay = await loadMistakeReplay({ mistake, userId });

  if (
    (!saved && mistake.status !== "open") ||
    replay?.kind !== "lesson" ||
    replay.lesson.step.kind !== "spokenAnswer" ||
    replay.lesson.step.id !== stepId
  ) {
    return { status: "notFound" };
  }

  if (!(await isValidSpokenAudio(audio))) {
    return { status: "invalidAudio" };
  }

  return gradeOpenRecording({
    attemptId,
    audio,
    fields,
    input,
    lesson: replay.lesson,
    mistake,
    step: replay.lesson.step,
    userId,
  });
}

type SpokenPractice = {
  attemptId: string;
  fields: SpokenAnswerFields;
  input: RecordingInput;
  lesson: MistakeLessonReplay;
  mistake: Mistake;
  step: Extract<PlayableLibraryStep, { kind: "spokenAnswer" }>;
  userId: string;
};

async function gradeOpenRecording({
  attemptId,
  audio,
  fields,
  input,
  lesson,
  mistake,
  step,
  userId,
}: SpokenPractice & { audio: SpokenAudio }): Promise<GradeSpokenAnswerResult> {
  const usage = await claimUsage({ kind: "assist", targetId: attemptId });

  if (usage.status !== "allowed") {
    if (fields.blockId && (usage.status === "limitReached" || usage.status === "signUpRequired")) {
      await countRunSoFar({ input });
    }

    return usage;
  }

  const graded = await runAnswerGrade({
    attemptId,
    cacheWithoutModelClaim: true,
    grade: () =>
      gradeSpokenRecording({
        audio,
        cacheExplanation: false,
        micStartupMs: fields.micStartupMs,
        step: {
          id: step.id,
          learnerLanguage: lesson.language,
          romanization: step.content.romanization,
          storedContent: step.content,
          targetLanguage: step.content.language,
          targetText: step.content.targetText,
        },
        userId,
      }),
    questionId: step.id,
    userId,
  });

  if (graded.status === "retryable") {
    return { retryAfterSeconds: 1, status: "slowDown" };
  }

  if (graded.result.status === "missedStart") {
    return { status: "missedStart" };
  }

  // A cached null grade also represents silence.
  if (graded.result.status === "noSpeech" || graded.result.grade === null) {
    return { status: "noSpeech" };
  }

  const grade = recordingGradeSchema.parse(graded.result.grade);
  return recordSpokenPractice({ attemptId, fields, grade, input, lesson, mistake, step, userId });
}

async function recordSpokenPractice({
  attemptId,
  fields,
  grade,
  input,
  lesson,
  mistake,
  step,
  userId,
}: SpokenPractice & {
  grade: Omit<SpokenAnswerGrade, "attemptId" | "practice">;
}): Promise<GradeSpokenAnswerResult> {
  const kind = getDrillKind(mistake.cause);

  const drilled = applyDrillRules({
    drill: { kind, timeLimitSeconds: getDrillTimeLimitSeconds(kind) },
    durationMs: fields.practiceDurationMs ?? fields.durationMs,
    isCorrect: grade.isCorrect,
    misconception: null,
  });

  const { timeZone } = input;
  await saveDayBeforeActivity({ goalId: input.run?.goalId, timeZone, userId });

  const evidence = await loadLanguageStepEvidence({
    isCorrect: grade.score >= SPOKEN_EVIDENCE_SCORE,
    lesson: { level: lesson.level, targetLanguage: lesson.targetLanguage },
    step: { kind: "spokenAnswer", wordId: null },
    userId,
  });

  const lessonResult = toCheckResult({
    savedMistake: !drilled.isCorrect,
    verdict: {
      answerText: grade.transcript,
      checked: true,
      correctAnswer: drilled.isCorrect ? null : step.content.targetText,
      corrections: [],
      expected: null,
      feedback: grade.explanation,
      isCorrect: drilled.isCorrect,
      keyPoints: null,
      score: grade.score,
      spelling: null,
    },
  });

  const feedback = {
    correctAnswer: null,
    explanation: grade.explanation,
    lessonResult,
    trap: drilled.trap,
    workedSteps: [],
  };

  const outcome = await recordAnswerOnce({
    answer: {
      answer: {
        kind: "spoken",
        practiceFeedback: feedback,
        practiceMistakeId: mistake.id,
        transcript: grade.transcript,
      },
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
    refuse: refuseClosedMistake({ mistakeId: mistake.id, userId }),
    withAnswer: evidence
      ? async (transaction, attempt) => {
          if (attempt.evidence === "replay") {
            await writeLanguageStepEvidence(transaction, evidence);
          }
        }
      : undefined,
  });

  if (outcome.status === "refused") {
    return { status: "notFound" };
  }

  if (outcome.status === "recorded" && outcome.recorded.attempt.evidence === "replay") {
    await schedulePronunciationReviews({
      targetLanguage: step.content.language,
      timeZone,
      userId,
      userLanguage: lesson.language,
      words: grade.wordsToPractice.map((word) => word.text),
    });
  }

  const practice = await finishPracticeAnswer({
    attempt: outcome.status === "saved" ? outcome.saved : outcome.recorded.attempt,
    feedback,
    input,
    mistakeId: mistake.id,
  });

  return { grade: { ...grade, attemptId, practice }, status: "graded" };
}
