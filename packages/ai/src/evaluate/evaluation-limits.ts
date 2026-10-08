import { type Experimental_DecisionQuestion } from "ai";

/**
 * Exact counts need each provider's tokenizer. Three characters per token
 * overestimates English and most Latin-script text, so a state that passes is
 * almost always under the real limit. Scripts that use more tokens per
 * character can still overflow; the provider error then triggers the fallback.
 */
const CHARACTERS_PER_TOKEN = 3;

function estimateTokens(value: unknown): number {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return Math.ceil(text.length / CHARACTERS_PER_TOKEN);
}

/**
 * Jev documents its limit as the state plus the longest question, not the
 * whole request, so only the largest question counts against it.
 */
export function fitsTokenLimit({
  limit,
  questions,
  state,
}: {
  limit: number;
  questions: Readonly<Record<string, Experimental_DecisionQuestion>>;
  state: string;
}): boolean {
  const longestQuestion = Math.max(
    0,
    ...Object.values(questions).map((question) => estimateTokens(question)),
  );

  return estimateTokens(state) + longestQuestion <= limit;
}
