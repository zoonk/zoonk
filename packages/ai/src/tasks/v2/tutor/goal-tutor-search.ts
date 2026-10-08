import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { decideBoolean } from "../../../evaluate/decisions";
import { evaluateQuestions } from "../../../evaluate/evaluate-questions";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import instructions from "./goal-tutor-search.prompt.md";

/** The runner-up when Jev errors or times out. */
const FALLBACK_EVALUATION_MODEL = "openai/gpt-6-luna";
const THRESHOLD = 0.5;

/**
 * Jev answers in about half a second. A decision slower than this leaves the search to the
 * buddy's own judgment, so a slow or failing classifier never holds the answer back.
 */
const DECISION_DEADLINE_MS = 2500;

/** The question the classifier answers about a buddy message. */
const goalTutorSearchClassifier = {
  questions: {
    needsCurrentSource: {
      criteria: {
        false:
          "Stable knowledge (concepts, language, math, science, history, study skills) or a question about the learner's own plan or the app.",
        true: "Answering it right depends on current law, court rulings, official or exam rules, figures or other facts that change.",
      },
      instructions,
      type: "boolean",
    },
  },
  toInput: ({
    earlierQuestion,
    goal,
    question,
  }: {
    earlierQuestion: string | null;
    goal: string;
    question: string;
  }) => ({ EARLIER_MESSAGE: earlierQuestion ?? "none", GOAL: goal, MESSAGE: question }),
} as const;

type SearchDecisionInput = Parameters<typeof goalTutorSearchClassifier.toInput>[0] & {
  analytics?: AiGenerationContext;
};

async function decideSearch({ analytics, ...input }: SearchDecisionInput): Promise<boolean> {
  const { answers } = await evaluateQuestions({
    analytics,
    fallbackModel: FALLBACK_EVALUATION_MODEL,
    input: goalTutorSearchClassifier.toInput(input),
    // The question is saved in the learner's conversation anyway.
    keepInput: true,
    questions: goalTutorSearchClassifier.questions,
    task: "goal-tutor-search",
  });

  return decideBoolean({
    probability: answers.needsCurrentSource.probability,
    threshold: THRESHOLD,
  });
}

function waitForDeadline(): Promise<false> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(false), DECISION_DEADLINE_MS);
  });
}

/**
 * Whether the buddy must search before answering: a question whose answer rests on facts that
 * change, above all the law, where a court can strike or reinterpret a provision whose text looks
 * settled (the buddy once called a contract clause void from memory, missing the STF's ADI 1194).
 * The model's own judgment skipped those searches, so a separate classifier decides. False when it
 * fails or runs past its deadline: the buddy can still search on its own.
 */
export async function shouldSearchFirst(input: SearchDecisionInput): Promise<boolean> {
  const { data, error } = await safeAsync(() =>
    Promise.race([decideSearch(input), waitForDeadline()]),
  );

  if (error) {
    logError("[Goal Tutor Search Decision Error]", error);
    return false;
  }

  return data;
}
