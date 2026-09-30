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

/**
 * The generality question for any evaluation model: Jev natively, other models
 * through the evaluation adapter, so the eval and production ask the same thing.
 */
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

type QuestionGenerality = EvaluationRunDetails & {
  /** True only when the model is confident; uncertain questions stay private. */
  isGeneral: boolean;
  /** P(general) from the model, kept for threshold tuning. */
  probability: number;
};

/**
 * Decides whether a quick-explanation question is general, so its explanation
 * can be found by identity search and reused by everyone asking the same thing
 * in other words, or personal, so it is made only for the asker.
 */
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
    // The question is stored with the goal or tutor thread that asked it.
    keepInput: true,
    questions: { isGeneral: questionGeneralityClassifier.question },
    task: "question-generality",
  });

  const { probability } = answers.isGeneral;
  const isGeneral = decideBoolean({ probability, threshold: GENERAL_AT });

  return { ...run, isGeneral, probability };
}
