import "server-only";
import { decideBoolean } from "../../../evaluate/decisions";
import { evaluateQuestions } from "../../../evaluate/evaluate-questions";
import { type MemoryFactText, formatMemoryFact } from "./memory-facts";
import instructions from "./memory-relevance.prompt.md";

/**
 * The runner-up from the memory-relevance eval (83% against Jev's 100%; Flash Lite was as accurate
 * but timed out), used when Jev errors, times out or can't fit the input.
 */
const FALLBACK_EVALUATION_MODEL = "anthropic/claude-haiku-4.5";

/** A fact that doesn't fit only costs a few tokens of context, so the cutoff sits at even odds. */
const RELEVANT_AT = 0.5;

export type MemoryRelevanceInput = { fact: MemoryFactText; need: string };

/** The relevance question for any evaluation model, so the eval and production ask the same thing. */
export const memoryRelevanceClassifier = {
  question: {
    criteria: {
      false: "Knowing the fact wouldn't change what this task produces for the learner.",
      true: "The task would use or should respect this fact: it changes the example, level, plan or tone.",
    },
    instructions,
    type: "boolean",
  } as const,
  toInput: ({ fact, need }: MemoryRelevanceInput) => ({ FACT: formatMemoryFact(fact), NEED: need }),
};

async function getRelevance<FACT extends MemoryFactText>({
  fact,
  need,
}: {
  fact: FACT;
  need: string;
}) {
  const { answers } = await evaluateQuestions({
    fallbackModel: FALLBACK_EVALUATION_MODEL,
    input: memoryRelevanceClassifier.toInput({ fact, need }),
    questions: { relevant: memoryRelevanceClassifier.question },
    task: "memory-relevance",
  });

  return { fact, probability: answers.relevant.probability };
}

/**
 * Keeps the facts a task would use, most relevant first, at most `limit`. Each fact is judged on
 * its own so one verdict reads only one fact, and the calls run together because Jev answers in a
 * fraction of a second.
 */
export async function selectRelevantMemoryFacts<FACT extends MemoryFactText>({
  facts,
  limit,
  need,
}: {
  facts: readonly FACT[];
  limit: number;
  need: string;
}): Promise<FACT[]> {
  const verdicts = await Promise.all(facts.map((fact) => getRelevance({ fact, need })));

  return verdicts
    .filter(({ probability }) => decideBoolean({ probability, threshold: RELEVANT_AT }))
    .toSorted((first, second) => second.probability - first.probability)
    .slice(0, limit)
    .map(({ fact }) => fact);
}
