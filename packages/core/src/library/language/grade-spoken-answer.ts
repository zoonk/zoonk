import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { after } from "next/server";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { claimAssist } from "../../entitlements/claim-usage";
import {
  loadLanguageStepEvidence,
  writeLanguageStepEvidence,
} from "../../language/levels/record-language-evidence";
import { schedulePronunciationReviews } from "../../language/pronunciation/schedule-pronunciation-reviews";
import {
  type RecordedOutcome,
  type RefusedOutcome,
  recordAnswerOnce,
} from "../../learner/_utils/answer-once";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { findClosingAnswer } from "../../lesson-player/_utils/answer-recording";
import { findFixedScreenIds } from "../../lesson-player/_utils/fixed-screens";
import { findPlayableStepRow, getAnswerSkillId } from "../../lesson-player/_utils/lesson-rows";
import { findOpenLessonRun } from "../../lesson-player/_utils/lesson-runs";
import { loadPlayableSteps } from "../../lesson-player/_utils/load-playable-steps";
import { gradeSpokenMistake } from "../../mistakes/grade-spoken-mistake";
import { type MistakeReplay } from "../../mistakes/mistake-replay";
import { getSession } from "../../users/get-session";
import { SPOKEN_EVIDENCE_SCORE, gradeSpokenRecording } from "./_utils/grade-spoken-recording";
import { type SpokenAudio, isValidSpokenAudio } from "./_utils/hear-spoken-sentence";
import {
  type GradeSpokenAnswerResult,
  type SpokenAnswerFields,
  type SpokenAnswerGrade,
} from "./spoken-answer-contract";

async function findSpokenStep({ stepId, userId }: { stepId: string; userId: string }) {
  const row = await findPlayableStepRow({ stepId, userId });

  if (!row || row.kind !== "spokenAnswer") {
    return null;
  }

  const [step] = await loadPlayableSteps({ lesson: row.lesson, rows: [row] });

  if (step?.kind !== "spokenAnswer") {
    return null;
  }

  const { content } = step;

  const replay: MistakeReplay = {
    kind: "lesson",
    lesson: {
      language: row.lesson.language,
      lessonId: row.lessonId,
      level: row.lesson.level,
      step,
      targetLanguage: row.lesson.targetLanguage,
    },
  };

  return {
    content,
    id: step.id,
    learnerLanguage: row.lesson.language,
    lessonId: row.lessonId,
    level: row.lesson.level,
    replay,
    sentenceId: row.sentenceId,
    skillId: getAnswerSkillId({
      lessonSkillIds: row.lesson.skills.map((skill) => skill.skillId),
      stepSkillId: step.skillId,
    }),
    storedContent: row.content,
    targetLanguage: content.language,
    targetText: content.targetText,
    wordId: row.wordId,
  };
}

type SpokenStep = NonNullable<Awaited<ReturnType<typeof findSpokenStep>>>;

type RecordingGrade = NonNullable<Awaited<ReturnType<typeof gradeSpokenRecording>>>;

function notScored(grade: RecordingGrade): SpokenAnswerGrade {
  return {
    ...grade,
    attemptId: null,
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

  const usage = await claimAssist();

  if (usage.status !== "allowed") {
    return usage;
  }

  const [grade, studySessionId] = await Promise.all([
    gradeSpokenRecording({ audio, step, userId }),
    findOwnStudySessionId({ studySessionId: fields.studySessionId, userId }),
  ]);

  if (!grade) {
    return { status: "noSpeech" };
  }

  // The learner may be reading the sentence as it was before a fix: an answer it no longer
  // matches is neither scored nor saved.
  if (!grade.isCorrect && (await isFixedDuringRun({ step, userId }))) {
    return { grade: notScored(grade), status: "graded" };
  }

  const question = `${step.content.prompt}\n${step.targetText}`;
  const timeZone = getAnswerTimeZone({ goal: null, timeZone: fields.timeZone });

  const evidence = await loadLanguageStepEvidence({
    isCorrect: grade.score >= SPOKEN_EVIDENCE_SCORE,
    lesson: { level: step.level, targetLanguage: step.targetLanguage },
    step: { kind: "spokenAnswer", wordId: null },
    userId,
  });

  const outcome = await recordAnswerOnce({
    answer: {
      answer: { kind: "spoken", transcript: grade.transcript },
      graded: { durationMs: fields.durationMs, isCorrect: grade.isCorrect, score: grade.score },
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
        until: receivedAt,
        userId,
      }),
    withAnswer: evidence
      ? (transaction) => writeLanguageStepEvidence(transaction, evidence)
      : undefined,
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
