import "server-only";
import { decideBoolean } from "../../../evaluate/decisions";
import { type EvaluationRunDetails, evaluateQuestions } from "../../../evaluate/evaluate-questions";
import { JEV_MODEL_ID } from "../../../evaluate/evaluation-models";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import instructions from "./memory-depth.prompt.md";

/**
 * Luna answered all 12 memory-depth cases (EN and PT); Jev answered 11, following a note that
 * told it to say yes. It runs only when a learner's preference notes change, so accuracy wins over
 * Jev's speed, and Jev is the fallback.
 */
const DEFAULT_MODEL = "openai/gpt-6-luna";

/**
 * Showing every screen's deeper version to someone who never asked would make lessons harder, so
 * only a confident "yes" turns it on.
 */
const ASKS_DEEPER_AT = 0.7;

/**
 * The one question about a learner's preference notes, shared by production and the eval so every
 * evaluation model answers exactly what production asks.
 */
export const memoryDepthClassifier = {
  question: {
    criteria: {
      false:
        "The notes are about something else, or ask for simpler, plainer or shorter explanations.",
      true: "The notes say the learner asked for more technical, advanced or rigorous explanations.",
    },
    instructions,
    type: "boolean",
  } as const,
  toInput: ({ preferences }: { preferences: readonly string[] }) => ({
    PREFERENCES: preferences.join("\n"),
  }),
};

type DeeperPreference = EvaluationRunDetails & {
  asksDeeper: boolean;
  /** P(asks deeper) from the model, kept for threshold tuning. */
  probability: number;
};

/**
 * Whether a learner's preference notes ask for the deeper, more technical version of lessons, so
 * lessons can open it first ("Go deeper" by default) without anyone writing new content.
 */
export async function detectDeeperPreference({
  analytics,
  preferences,
}: {
  analytics?: AiGenerationContext;
  /** The learner's active preference notes, oldest first. */
  preferences: readonly string[];
}): Promise<DeeperPreference> {
  const { answers, ...run } = await evaluateQuestions({
    analytics,
    fallbackModel: JEV_MODEL_ID,
    input: memoryDepthClassifier.toInput({ preferences }),
    // The notes are the learner's stored memory facts and go away with them.
    keepInput: true,
    model: DEFAULT_MODEL,
    questions: { asksDeeper: memoryDepthClassifier.question },
    task: "memory-depth",
  });

  const { probability } = answers.asksDeeper;
  const asksDeeper = decideBoolean({ probability, threshold: ASKS_DEEPER_AT });

  return { ...run, asksDeeper, probability };
}
