import "server-only";
import { prisma } from "@zoonk/db";
import { after } from "next/server";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { claimAssist } from "../../entitlements/claim-usage";
import { recordLanguageStepEvidence } from "../../language/levels/record-language-evidence";
import { schedulePronunciationReviews } from "../../language/pronunciation/schedule-pronunciation-reviews";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { recordLearnerAnswer } from "../../learner/record-learner-answer";
import { scheduleMistakeCause } from "../../mistakes/resolve-mistake-cause";
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

/** A sentence mostly said as expected counts as evidence the learner can say it at that level. */
const SPOKEN_EVIDENCE_SCORE = 0.8;

/** Private lessons are made for one learner, so only their owner can answer their steps. */
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
    level: step.lesson.level,
    skillId: step.skillId,
    targetLanguage: content.language,
    targetText: content.targetText,
  };
}

/** Links the attempt to today's study session only when it is the learner's own. */
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

/**
 * Grades a spoken answer to a lesson's "say it out loud" step: transcribes it
 * as said, compares it with the expected sentence word by word, explains at
 * most two words that didn't match (reusing the explanation when someone said
 * the same thing before) and records the attempt. Those words come back later
 * as pronunciation reviews. An accent never blocks progress: the result says
 * what we heard and the lesson goes on. The audio is only held in memory for
 * grading and never stored. Every answer calls a paid model, so each is claimed
 * as small AI help (`claimAssist`) first.
 */
export async function gradeSpokenAnswer({
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

  const userId = session.user.id;

  if (!isValidSpokenAudio(audio)) {
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

  const recorded = await recordLearnerAnswer({
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
  });

  scheduleMistakeCause(recorded.causeRequest);

  await schedulePronunciationReviews({
    targetLanguage: step.targetLanguage,
    timeZone,
    userId,
    userLanguage: step.learnerLanguage,
    words: wordsToPractice.map((word) => word.text),
  });

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

  await recordLanguageStepEvidence({
    isCorrect: match.score >= SPOKEN_EVIDENCE_SCORE,
    lesson: { level: step.level, targetLanguage: step.targetLanguage },
    step: { kind: "spokenAnswer", wordId: null },
    userId,
  });

  return {
    grade: {
      attemptId: recorded.attempt.id,
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
