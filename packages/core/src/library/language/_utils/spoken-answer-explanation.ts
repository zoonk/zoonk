import "server-only";
import { explainSpokenAnswer } from "@zoonk/ai/tasks/v2/language/explain-spoken-answer";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { findAnswerExplanation, saveAnswerExplanation } from "../../items/answer-explanations";
import { type SpokenPracticeWord } from "./practice-words";

type SpokenStep = {
  id: string;
  learnerLanguage: string;
  targetLanguage: string;
  targetText: string;
};

async function writeExplanation({
  heard,
  step,
  userId,
  words,
}: {
  heard: string;
  step: SpokenStep;
  userId: string;
  words: readonly SpokenPracticeWord[];
}) {
  return explainSpokenAnswer({
    analytics: { contentScope: "shared", distinctId: userId },
    expectedSentence: step.targetText,
    heard,
    learnerLanguage: step.learnerLanguage,
    targetLanguage: step.targetLanguage,
    words: words.map((word) => ({
      expected: word.text,
      heard: word.heard,
      ...(word.respelling ? { respelling: word.respelling } : {}),
    })),
  });
}

/**
 * Explains the words that didn't match, in the learner's language. The same
 * transcript on the same step gets the stored explanation, so a common
 * mistake is explained once. The grade stands without it: a failed model
 * call leaves the explanation out instead of failing the answer.
 */
export async function getSpokenAnswerExplanation({
  heard,
  normalizedHeard,
  step,
  userId,
  words,
}: {
  heard: string;
  normalizedHeard: string;
  step: SpokenStep;
  userId: string;
  words: readonly SpokenPracticeWord[];
}): Promise<string | null> {
  const target = { stepId: step.id };
  const language = step.learnerLanguage;
  const stored = await findAnswerExplanation({ answer: normalizedHeard, language, target });

  if (stored) {
    return stored.explanation;
  }

  const { data, error } = await safeAsync(() => writeExplanation({ heard, step, userId, words }));

  if (error) {
    logError("Error explaining a spoken answer:", error);
    return null;
  }

  const saved = await saveAnswerExplanation({
    answer: normalizedHeard,
    explanation: data.data.explanation,
    language,
    provenance: data.provenance,
    target,
  });

  return saved.explanation;
}
