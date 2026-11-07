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
import { getSession } from "../../users/get-session";
import { libraryRowsVisibleTo } from "../_utils/library-visibility";
import { parseStepContent } from "../steps/contract/step-contract";
import {
  type SpokenAudio,
  hearSpokenSentence,
  isValidSpokenAudio,
} from "./_utils/hear-spoken-sentence";
import { loadPracticeWords } from "./_utils/practice-words";
import { getSpokenAnswerExplanation } from "./_utils/spoken-answer-explanation";
import { type GradeSpokenAnswerResult, type SpokenAnswerFields } from "./spoken-answer-contract";
import { pickWordsToExplain } from "./spoken-answer-match";

const SPOKEN_EVIDENCE_SCORE = 0.8;

async function findSpokenStep({ stepId, userId }: { stepId: string; userId: string }) {
  const step = await prisma.step.findFirst({
    include: { lesson: { select: { language: true, level: true } } },
    where: { id: stepId, kind: "spokenAnswer", lesson: libraryRowsVisibleTo(userId) },
  });

  if (!step) {
    return null;
  }

  const content = parseStepContent("spokenAnswer", step.content);

  return {
    content,
    id: step.id,
    learnerLanguage: step.lesson.language,
    lessonId: step.lessonId,
    level: step.lesson.level,
    skillId: step.skillId,
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

  const { match, transcript } = await hearSpokenSentence({
    audio,
    expected: step.targetText,
    language: step.targetLanguage,
    userId,
  });

  if (!match.normalizedHeard) {
    return { status: "noSpeech" };
  }

  const wordsToPractice = await loadPracticeWords({
    learnerLanguage: step.learnerLanguage,
    targetLanguage: step.targetLanguage,
    words: match.isCorrect ? [] : pickWordsToExplain(match.words),
  });

  const [explanation, studySessionId] = await Promise.all([
    match.isCorrect
      ? null
      : getSpokenAnswerExplanation({
          heard: transcript,
          normalizedHeard: match.normalizedHeard,
          step,
          userId,
          words: wordsToPractice,
        }),
    findOwnStudySessionId({ studySessionId: fields.studySessionId, userId }),
  ]);

  const question = `${step.content.prompt}\n${step.targetText}`;
  const timeZone = getAnswerTimeZone({ goal: null, timeZone: fields.timeZone });

  const evidence = await loadLanguageStepEvidence({
    isCorrect: match.score >= SPOKEN_EVIDENCE_SCORE,
    lesson: { level: step.level, targetLanguage: step.targetLanguage },
    step: { kind: "spokenAnswer", wordId: null },
    userId,
  });

  const outcome = await recordAnswerOnce({
    answer: {
      answer: { kind: "spoken", transcript },
      graded: { durationMs: fields.durationMs, isCorrect: match.isCorrect, score: match.score },
      language: step.learnerLanguage,
      mistake: {
        questionText: question,
        snapshot: {
          answer: transcript,
          correctAnswer: step.targetText,
          explanation,
          format: "spoken",
          question,
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
        isCorrect: match.isCorrect,
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
      isCorrect: match.isCorrect,
      score: match.score,
      transcript,
      words: match.words,
      wordsToPractice,
    },
    status: "graded",
  };
}
