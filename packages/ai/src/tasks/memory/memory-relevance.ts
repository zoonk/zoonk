import "server-only";
import { decideBoolean } from "../../evaluate/decisions";
import { evaluateQuestions } from "../../evaluate/evaluate-questions";
import { type MemoryFactText, formatMemoryFact } from "./memory-facts";
import instructions from "./memory-relevance.prompt.md";

/**
 * On 30 cases (8 Nov 2026), Decider V1.2 and Mammoth got every one (EN 15/15, PT 15/15) at $0.0091
 * and $0.0463 per 1k; Jev ($0.0282) missed one and Haiku 5.5 another.
 */
const EVALUATION_MODEL = "perplexity/pplx-decider-v1.2";
const FALLBACK_EVALUATION_MODEL = "baseten/mammoth-1";

/** A fact that doesn't fit only costs a few tokens of context, so the cutoff sits at even odds. */
const RELEVANT_AT = 0.5;

export type MemoryRelevanceInput = { fact: MemoryFactText; need: string };

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
    model: EVALUATION_MODEL,
    questions: { relevant: memoryRelevanceClassifier.question },
    task: "memory-relevance",
  });

  return { fact, probability: answers.relevant.probability };
}

/**
 * Each fact is judged on its own so one verdict reads only one fact; the calls run together since
 * each answers in a fraction of a second.
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
