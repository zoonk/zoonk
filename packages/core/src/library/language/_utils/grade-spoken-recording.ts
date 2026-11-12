import "server-only";
import { type SpokenAnswerGrade } from "../spoken-answer-contract";
import { pickWordsToExplain } from "../spoken-answer-match";
import { type SpokenAudio, hearSpokenSentence } from "./hear-spoken-sentence";
import { loadPracticeWords } from "./practice-words";
import { getSpokenAnswerExplanation } from "./spoken-answer-explanation";

export const SPOKEN_EVIDENCE_SCORE = 0.8;

export async function gradeSpokenRecording({
  audio,
  cacheExplanation = true,
  step,
  userId,
}: {
  audio: SpokenAudio;
  cacheExplanation?: boolean;
  step: {
    id: string;
    learnerLanguage: string;
    storedContent: unknown;
    targetLanguage: string;
    targetText: string;
  };
  userId: string;
}): Promise<Omit<SpokenAnswerGrade, "attemptId" | "practice"> | null> {
  const { match, transcript } = await hearSpokenSentence({
    audio,
    expected: step.targetText,
    language: step.targetLanguage,
    userId,
  });

  if (!match.normalizedHeard) {
    return null;
  }

  const wordsToPractice = await loadPracticeWords({
    learnerLanguage: step.learnerLanguage,
    targetLanguage: step.targetLanguage,
    words: match.isCorrect ? [] : pickWordsToExplain(match.words),
  });

  const explanation = match.isCorrect
    ? null
    : await getSpokenAnswerExplanation({
        cache: cacheExplanation,
        heard: transcript,
        normalizedHeard: match.normalizedHeard,
        step,
        userId,
        words: wordsToPractice,
      });

  return {
    explanation,
    isCorrect: match.isCorrect,
    score: match.score,
    transcript,
    words: match.words,
    wordsToPractice,
  };
}
