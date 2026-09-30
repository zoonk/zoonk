import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { claimAssist } from "../../entitlements/claim-usage";
import { type RefusedUsage } from "../../entitlements/contract";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { recordLearnerAnswer } from "../../learner/record-learner-answer";
import {
  type SpokenAudio,
  hearSpokenSentence,
  isValidSpokenAudio,
} from "../../library/language/_utils/hear-spoken-sentence";
import { getSession } from "../../users/get-session";
import {
  type PronunciationAnswerFields,
  type PronunciationAnswerGrade,
} from "./pronunciation-contract";
import { nextPronunciationReview } from "./pronunciation-rules";

export type AnswerPronunciationReviewResult =
  | { grade: PronunciationAnswerGrade; status: "graded" }
  | RefusedUsage
  | { status: "invalidAudio" }
  | { status: "noSpeech" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/**
 * Grades the learner saying one review word: what we heard is compared with the word, the answer
 * is recorded (it counts as time spoken in the language), and the word climbs a rung when it was
 * said right or starts over when it wasn't. Every answer calls a paid model, so each is claimed as
 * small AI help (`claimAssist`) first. The audio is only held in memory for grading.
 */
export async function answerPronunciationReview({
  audio,
  fields,
  reviewId,
}: {
  audio: SpokenAudio;
  fields: PronunciationAnswerFields;
  reviewId: string;
}): Promise<AnswerPronunciationReviewResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  if (!isValidSpokenAudio(audio)) {
    return { status: "invalidAudio" };
  }

  if (!isUuid(reviewId)) {
    return { status: "notFound" };
  }

  const review = await prisma.pronunciationReview.findFirst({
    include: { word: true },
    where: { id: reviewId, userId },
  });

  if (!review) {
    return { status: "notFound" };
  }

  const usage = await claimAssist();

  if (usage.status !== "allowed") {
    return usage;
  }

  // A word said on its own has no sentence to help a listener, so an audio model judges whether it
  // would be recognized alone, falling back to transcription if it fails.
  const { match, transcript } = await hearSpokenSentence({
    audio,
    check: "thorough",
    expected: review.word.word,
    language: review.language,
    learnerLanguage: review.userLanguage,
    userId,
  });

  if (!match.normalizedHeard) {
    return { status: "noSpeech" };
  }

  const timeZone = getAnswerTimeZone({ goal: null, timeZone: fields.timeZone });
  const now = new Date();

  const recorded = await recordLearnerAnswer({
    answer: {
      kind: "spoken",
      pronunciationReviewId: review.id,
      roundId: fields.roundId,
      transcript,
    },
    answeredAt: now,
    graded: { durationMs: fields.durationMs, isCorrect: match.isCorrect, score: match.score },
    language: review.userLanguage,
    purpose: "learning",
    targetLanguage: review.language,
    timeZone,
    userId,
  });

  const next = nextPronunciationReview({
    isCorrect: match.isCorrect,
    now,
    stage: review.stage,
    timeZone,
  });

  await prisma.pronunciationReview.update({
    data: { ...next, lastReviewedAt: now },
    where: { id: review.id },
  });

  return {
    grade: {
      attemptId: recorded.attempt.id,
      isCorrect: match.isCorrect,
      nextReviewAt: next.dueAt?.toISOString() ?? null,
      transcript,
    },
    status: "graded",
  };
}
