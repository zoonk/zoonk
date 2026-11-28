import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { after } from "next/server";
import { z } from "zod";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { claimUsage } from "../../entitlements/claim-usage";
import {
  loadLanguageStepEvidence,
  writeLanguageStepEvidence,
} from "../../language/levels/record-language-evidence";
import { schedulePronunciationReviews } from "../../language/pronunciation/schedule-pronunciation-reviews";
import {
  type RecordedOutcome,
  type RefusedOutcome,
  getAnswerAttemptId,
  recordAnswerOnce,
} from "../../learner/_utils/answer-once";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { runAnswerGrade } from "../../learner/_utils/run-answer-grade";
import { findClosingAnswer } from "../../lesson-player/_utils/answer-recording";
import { findFixedScreenIds } from "../../lesson-player/_utils/fixed-screens";
import { findOpenLessonRun } from "../../lesson-player/_utils/lesson-runs";
import { gradeSpokenMistake } from "../../mistakes/grade-spoken-mistake";
import { recordLessonWindowAnswer } from "../../sessions/_utils/record-lesson-window";
import { getSession } from "../../users/get-session";
import { type SpokenStep, findSpokenStep } from "./_utils/find-spoken-step";
import { SPOKEN_EVIDENCE_SCORE, gradeSpokenRecording } from "./_utils/grade-spoken-recording";
import { type SpokenAudio, isValidSpokenAudio } from "./_utils/hear-spoken-sentence";
import {
  type GradeSpokenAnswerResult,
  type SpokenAnswerFields,
  type SpokenAnswerGrade,
  spokenAnswerGradeSchema,
} from "./spoken-answer-contract";

/** Apps built before `checked` require an attempt id, so the unsaved take gets one nothing saved. */
function notScored(grade: Omit<SpokenAnswerGrade, "attemptId" | "practice">): SpokenAnswerGrade {
  return {
    ...grade,
    attemptId: crypto.randomUUID(),
    checked: false,
    explanation: null,
    words: [],
    wordsToPractice: [],
  };
}

/** Speech isn't sent with its run, so the learner's open run of the lesson tells when they started. */
async function isFixedDuringRun({ step, userId }: { step: SpokenStep; userId: string }) {
  const run = await findOpenLessonRun({ lessonId: step.lessonId, userId });

  if (!run) {
    return false;
  }

  const fixed = await findFixedScreenIds({ screens: [step], startedAt: run.startedAt });
  return fixed.has(step.id);
}

async function findOwnStudySessionId({
  studySessionId,
  userId,
}: {
  studySessionId?: string;
  userId: string;
}): Promise<string | null> {
  if (!studySessionId) {
    return null;
  }

  const session = await prisma.studySession.findFirst({
    select: { id: true },
    where: { id: studySessionId, userId },
  });

  return session?.id ?? null;
}

function getSpokenAttemptId(outcome: RecordedOutcome | RefusedOutcome<string>): string {
  if (outcome.status === "refused") {
    return outcome.refusal;
  }

  return outcome.status === "saved" ? outcome.saved.id : outcome.recorded.attempt.id;
}

export async function gradeSpokenAnswer({
  audio,
  fields,
  stepId,
}: {
  audio: SpokenAudio;
  fields: SpokenAnswerFields;
  stepId: string;
}): Promise<GradeSpokenAnswerResult> {
  if (fields.mistakeId) {
    return gradeSpokenMistake({ audio, fields, stepId });
  }

  const receivedAt = new Date();
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  if (!(await isValidSpokenAudio(audio))) {
    return { status: "invalidAudio" };
  }

  const step = await findSpokenStep({ stepId, userId });

  if (!step) {
    return { status: "notFound" };
  }

  const recordingId = fields.attemptId
    ? getAnswerAttemptId({
        key: fields.attemptId,
        questionId: `lesson-recording:${stepId}`,
        userId,
      })
    : crypto.randomUUID();

  const usage = await claimUsage({ kind: "assist", targetId: recordingId });

  if (usage.status !== "allowed") {
    return usage;
  }

  const hear = async (): Promise<
    | Extract<GradeSpokenAnswerResult, { status: "graded" | "missedStart" | "noSpeech" }>
    | (z.infer<typeof heardRecordingSchema> & { status: "heard" })
  > => {
    const [heard, studySessionId] = await Promise.all([
      gradeSpokenRecording({ audio, micStartupMs: fields.micStartupMs, step, userId }),
      findOwnStudySessionId({ studySessionId: fields.studySessionId, userId }),
    ]);

    if (heard.status !== "graded") {
      return heard;
    }

    if (!heard.grade.isCorrect && (await isFixedDuringRun({ step, userId }))) {
      return { grade: notScored(heard.grade), status: "graded" as const };
    }

    return {
      durationMs: fields.durationMs,
      grade: { ...heard.grade, attemptId: recordingId },
      receivedAt: receivedAt.toISOString(),
      status: "heard" as const,
      studySessionId,
      timeZone: getAnswerTimeZone({ goal: null, timeZone: fields.timeZone }),
    };
  };

  if (!fields.attemptId) {
    const result = await hear();
    return result.status === "heard" ? recordSpokenGrade({ ...result, step, userId }) : result;
  }

  const claim = {
    attemptId: recordingId,
    cacheWithoutModelClaim: true,
    questionId: step.id,
    userId,
  };

  let result = await runAnswerGrade({ ...claim, grade: hear });

  if (result.status === "ready" && result.result.status === "heard") {
    const heard = heardRecordingSchema.parse(result.result);

    result = await runAnswerGrade({
      ...claim,
      acceptsSaved: (saved) => saved.status !== "heard",
      grade: () => recordSpokenGrade({ ...heard, step, userId }),
    });
  }

  if (result.status === "retryable") {
    return { retryAfterSeconds: 1, status: "slowDown" };
  }

  const { status, grade } = result.result;

  return status === "noSpeech" || status === "missedStart"
    ? { status }
    : { grade: spokenAnswerGradeSchema.parse(grade), status: "graded" };
}

const heardRecordingSchema = z.object({
  durationMs: z.number(),
  grade: spokenAnswerGradeSchema,
  receivedAt: z.string(),
  studySessionId: z.string().nullable(),
  timeZone: z.string(),
});

async function recordSpokenGrade({
  durationMs,
  grade,
  receivedAt,
  step,
  studySessionId,
  timeZone,
  userId,
}: z.infer<typeof heardRecordingSchema> & { step: SpokenStep; userId: string }): Promise<
  Extract<GradeSpokenAnswerResult, { status: "graded" }>
> {
  const question = `${step.content.prompt}\n${step.targetText}`;

  const evidence = await loadLanguageStepEvidence({
    isCorrect: grade.score >= SPOKEN_EVIDENCE_SCORE,
    lesson: { level: step.level, targetLanguage: step.targetLanguage },
    step: { kind: "spokenAnswer", wordId: null },
    userId,
  });

  const outcome = await recordAnswerOnce({
    answer: {
      answer: { kind: "spoken", transcript: grade.transcript },
      attemptId: grade.attemptId,
      graded: { durationMs, isCorrect: grade.isCorrect, score: grade.score },
      language: step.learnerLanguage,
      mistake: {
        questionText: question,
        snapshot: {
          answer: grade.transcript,
          correctAnswer: step.targetText,
          explanation: grade.explanation,
          format: "spoken",
          question,
          replay: step.replay,
        },
      },
      purpose: "learning",
      skillId: step.skillId,
      stepId: step.id,
      studySessionId,
      targetLanguage: step.targetLanguage,
      timeZone,
      userId,
    },
    refuse: (client: TransactionClient) =>
      findClosingAnswer({
        client,
        isCorrect: grade.isCorrect,
        lessonId: step.lessonId,
        stepId: step.id,
        until: new Date(receivedAt),
        userId,
      }),
    withAnswer: async (transaction, attempt) => {
      if (evidence) {
        await writeLanguageStepEvidence(transaction, evidence);
      }

      await recordLessonWindowAnswer(transaction, {
        attempt,
        kind: "spokenAnswer",
        lessonId: step.lessonId,
      });
    },
  });

  const attemptId = getSpokenAttemptId(outcome);

  if (outcome.status === "recorded") {
    await schedulePronunciationReviews({
      targetLanguage: step.targetLanguage,
      timeZone,
      userId,
      userLanguage: step.learnerLanguage,
      words: grade.wordsToPractice.map((word) => word.text),
    });
  }

  if (grade.explanation) {
    after(() =>
      trackLearnerEvents({
        events: [
          {
            name: "Pronunciation Tip Shown",
            properties: { skill_id: step.skillId, target_language: step.targetLanguage },
          },
        ],
        userId,
      }),
    );
  }

  return {
    grade: {
      attemptId,
      explanation: grade.explanation,
      isCorrect: grade.isCorrect,
      score: grade.score,
      transcript: grade.transcript,
      words: grade.words,
      wordsToPractice: grade.wordsToPractice,
    },
    status: "graded",
  };
}
