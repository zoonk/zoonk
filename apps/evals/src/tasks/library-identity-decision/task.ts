import { type Task } from "@/lib/types";
import {
  LIBRARY_IDENTITY_MIN_PROBABILITY,
  evaluateLibraryIdentityPair,
  getLibraryIdentityQuestion,
} from "@zoonk/ai/tasks/v2/identity/decision";
import {
  type LibraryIdentityDecisionExpected,
  type LibraryIdentityDecisionInput,
  type LibraryIdentityDecisionOutput,
  scoreLibraryIdentityDecision,
} from "./scorer";
import { TEST_CASES } from "./test-cases";

/**
 * Runs the production question on one pair with the requested model and no
 * fallback, so each row measures that model. The verdict uses the production
 * cutoff, and the probability is kept so the cutoff can be recalibrated.
 */
async function decideIdentityPair({
  candidate,
  model,
  subject,
}: LibraryIdentityDecisionInput & { model: string }) {
  const run = await evaluateLibraryIdentityPair({
    candidate: { id: "candidate", item: candidate },
    fallbackModel: model,
    model,
    subject,
  });

  return {
    data: { reuse: run.probability >= LIBRARY_IDENTITY_MIN_PROBABILITY },
    probabilities: { true: run.probability },
    systemPrompt: getLibraryIdentityQuestion(subject.kind).instructions,
    usage: run.usage,
    userPrompt: run.state,
  };
}

/**
 * The decision is always an evaluation question, so both routes run it: Jev
 * natively, and language models through the evaluation adapter.
 */
export const libraryIdentityDecisionTask: Task<
  LibraryIdentityDecisionInput,
  LibraryIdentityDecisionOutput,
  LibraryIdentityDecisionExpected
> = {
  description: "Decide whether an existing Library item can replace a requested one",
  evaluate: decideIdentityPair,
  generate: decideIdentityPair,
  id: "library-identity-decision",
  name: "Library Identity Decision",
  score: scoreLibraryIdentityDecision,
  testCases: TEST_CASES,
};
