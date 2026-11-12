import "server-only";
import { explainSpokenAnswer } from "@zoonk/ai/tasks/language/explain-spoken-answer";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { findAnswerExplanation, saveAnswerExplanation } from "../../items/answer-explanations";
import { type SpokenPracticeWord } from "./practice-words";

type SpokenStep = {
  id: string;
  learnerLanguage: string;
  /** The step's content as stored, which a new explanation is saved against. */
  storedContent: unknown;
  targetLanguage: string;
  targetText: string;
};

async function writeExplanation({
  cache,
  heard,
  step,
  userId,
  words,
}: {
  cache: boolean;
  heard: string;
  step: SpokenStep;
  userId: string;
  words: readonly SpokenPracticeWord[];
}) {
  return explainSpokenAnswer({
    analytics: { contentScope: cache ? "shared" : "personal", distinctId: userId },
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

export async function getSpokenAnswerExplanation({
  cache = true,
  heard,
  normalizedHeard,
  step,
  userId,
  words,
}: {
  cache?: boolean;
  heard: string;
  normalizedHeard: string;
  step: SpokenStep;
  userId: string;
  words: readonly SpokenPracticeWord[];
}): Promise<string | null> {
  const target = { stepId: step.id };
  const language = step.learnerLanguage;

  const stored = cache
    ? await findAnswerExplanation({ answer: normalizedHeard, language, target })
    : null;

  if (stored) {
    return stored.explanation;
  }

  const { data, error } = await safeAsync(() =>
    writeExplanation({ cache, heard, step, userId, words }),
  );

  if (error) {
    logError("Error explaining a spoken answer:", error);
    return null;
  }

  if (!cache) {
    return data.data.explanation;
  }

  const saved = await saveAnswerExplanation({
    answer: normalizedHeard,
    explanation: data.data.explanation,
    language,
    provenance: data.provenance,
    target,
    targetContent: step.storedContent,
  });

  return saved?.explanation ?? null;
}
