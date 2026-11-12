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
import { findPlayableStepRow, getAnswerSkillId } from "../../lesson-player/_utils/lesson-rows";
import { loadPlayableSteps } from "../../lesson-player/_utils/load-playable-steps";
import { gradeSpokenMistake } from "../../mistakes/grade-spoken-mistake";
import { type MistakeReplay } from "../../mistakes/mistake-replay";
import { getSession } from "../../users/get-session";
import { SPOKEN_EVIDENCE_SCORE, gradeSpokenRecording } from "./_utils/grade-spoken-recording";
import { type SpokenAudio, isValidSpokenAudio } from "./_utils/hear-spoken-sentence";
import { type GradeSpokenAnswerResult, type SpokenAnswerFields } from "./spoken-answer-contract";

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
    skillId: getAnswerSkillId({
      lessonSkillIds: row.lesson.skills.map((skill) => skill.skillId),
      stepSkillId: step.skillId,
    }),
    storedContent: row.content,
    targetLanguage: content.language,
    targetText: content.targetText,
  };
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

  const { explanation, transcript, wordsToPractice } = grade;

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
      answer: { kind: "spoken", transcript },
      graded: { durationMs: fields.durationMs, isCorrect: grade.isCorrect, score: grade.score },
      language: step.learnerLanguage,
      mistake: {
        questionText: question,
        snapshot: {
          answer: transcript,
          correctAnswer: step.targetText,
          explanation,
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
      words: wordsToPractice.map((word) => word.text),
    });
  }

  if (explanation) {
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
      explanation,
      isCorrect: grade.isCorrect,
      score: grade.score,
      transcript,
      words: grade.words,
      wordsToPractice,
    },
    status: "graded",
  };
}
