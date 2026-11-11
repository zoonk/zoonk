import "server-only";
import { decideBoolean } from "../../evaluate/decisions";
import { type EvaluationRunDetails, evaluateQuestions } from "../../evaluate/evaluate-questions";
import { JEV_MODEL_ID } from "../../evaluate/evaluation-models";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import instructions from "./question-generality.prompt.md";

/**
 * At the 0.6 cutoff on 16 cases (8 Nov 2026), Microsoft Decision-1 matched Jev on every label (EN
 * 6/6, PT 10/10) at $0.0181 against $0.0281 per 1k decisions. Cheaper Joey left a personal answer
 * 0.004 under the cutoff, and both Deciders shared a personal one.
 */
const EVALUATION_MODEL = "microsoft/microsoft-decision-1";

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
    fallbackModel: JEV_MODEL_ID,
    input: questionGeneralityClassifier.toInput({ question }),
    // The question is stored with the goal that asked it.
    keepInput: true,
    model: EVALUATION_MODEL,
    questions: { isGeneral: questionGeneralityClassifier.question },
    task: "question-generality",
  });

  const { probability } = answers.isGeneral;
  const isGeneral = decideBoolean({ probability, threshold: GENERAL_AT });

  return { ...run, isGeneral, probability };
}
