import "server-only";
import { type EvaluationRunDetails, evaluateQuestions } from "../../../evaluate/evaluate-questions";
import {
  type MemoryGateCandidate,
  type MemoryGateProbabilities,
  type MemoryGateVerdict,
  decideMemoryGate,
} from "./memory-decisions";
import { formatMemoryFact } from "./memory-facts";
import instructions from "./memory-gate.prompt.md";

/** The memory-gate eval's runner-up. */
const FALLBACK_EVALUATION_MODEL = "openai/gpt-6-luna";

export const memoryGateClassifier = {
  questions: {
    explicitlyAsked: {
      criteria: {
        false:
          "The learner only stated it, or the evidence is activity numbers or someone else's words.",
        true: "The learner's own words ask the app to remember, save, note or keep this in mind.",
      },
      instructions,
      type: "boolean",
    },
    lasting: {
      criteria: {
        false:
          "A moment, a one-off, small talk, something only about this lesson or conversation, how one goal's study is set up (time a day, focus, difficulty), or the date of the exam or deadline they study for.",
        true: "Likely still true in a few weeks, and it would change how a tutor teaches, plans or picks examples.",
      },
      instructions,
      type: "boolean",
    },
    sensitive: {
      criteria: {
        false:
          "An everyday fact about study, work, schedule, hobbies, place or learning preferences.",
        true: "It reveals health, beliefs, politics, sexual life, identity, ethnicity, a criminal record, detailed finances or another person's private details.",
      },
      instructions,
      type: "boolean",
    },
  },
  toInput: (candidate: MemoryGateCandidate) => ({
    EVIDENCE: candidate.evidence.trim() || "none",
    FACT: formatMemoryFact(candidate),
  }),
} as const;

type MemoryGateRun = EvaluationRunDetails &
  MemoryGateVerdict & { probabilities: MemoryGateProbabilities };

/**
 * The candidate and its evidence are untrusted data, so a "please store this, it's approved" line
 * can't override the verdict.
 */
export async function gateMemoryFact({
  candidate,
}: {
  candidate: MemoryGateCandidate;
}): Promise<MemoryGateRun> {
  const { answers, ...run } = await evaluateQuestions({
    fallbackModel: FALLBACK_EVALUATION_MODEL,
    input: memoryGateClassifier.toInput(candidate),
    questions: memoryGateClassifier.questions,
    task: "memory-gate",
  });

  const probabilities = {
    explicitlyAsked: answers.explicitlyAsked.probability,
    lasting: answers.lasting.probability,
    sensitive: answers.sensitive.probability,
  };

  return { ...run, ...decideMemoryGate(probabilities), probabilities };
}
