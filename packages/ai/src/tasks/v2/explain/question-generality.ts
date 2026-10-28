import "server-only";
import { decideBoolean } from "../../../evaluate/decisions";
import { type EvaluationRunDetails, evaluateQuestions } from "../../../evaluate/evaluate-questions";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import instructions from "./question-generality.prompt.md";

const fallbackModel = "openai/gpt-6-luna";

/**
 * Sharing a personal answer with strangers is worse than generating one more
 * explanation, so only a confident "general" is shared.
 */
const GENERAL_AT = 0.6;

export const questionGeneralityClassifier = {
  question: {
    criteria: {
      false:
        "A useful answer depends on the asker's own situation, data, documents or decisions, so it can't be shared.",
      true: "The explanation would be the same for anyone who asks, so it can be shared.",
    },
    instructions,
    type: "boolean",
  } as const,
  toInput: ({ question }: { question: string }) => ({ QUESTION: question }),
};

type QuestionGenerality = EvaluationRunDetails & { isGeneral: boolean; probability: number };

export async function classifyQuestionGenerality({
  analytics,
  question,
}: {
  /** The asker, so the logged question goes away with them. */
  analytics?: AiGenerationContext;
  question: string;
}): Promise<QuestionGenerality> {
  const { answers, ...run } = await evaluateQuestions({
    analytics,
    fallbackModel,
    input: questionGeneralityClassifier.toInput({ question }),
    // The question is stored with the goal that asked it.
    keepInput: true,
    questions: { isGeneral: questionGeneralityClassifier.question },
    task: "question-generality",
  });

  const { probability } = answers.isGeneral;
  const isGeneral = decideBoolean({ probability, threshold: GENERAL_AT });

  return { ...run, isGeneral, probability };
}
