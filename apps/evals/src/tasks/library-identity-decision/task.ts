import { type Task } from "@/lib/types";
import {
  LIBRARY_IDENTITY_MIN_PROBABILITY,
  evaluateLibraryIdentityCandidates,
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
 * Runs the production question on the labeled candidate among the other candidates of its case,
 * as production judges a search's candidates together, with the requested model and no fallback,
 * so each row measures that model. The verdict uses the production cutoff, and the probability is
 * kept so the cutoff can be recalibrated.
 */
async function decideIdentityPair({
  candidate,
  model,
  others = [],
  position = 0,
  subject,
}: LibraryIdentityDecisionInput & { model: string }) {
  const items = others.toSpliced(position, 0, candidate);

  const run = await evaluateLibraryIdentityCandidates({
    candidates: items.map((item, index) => ({ id: `candidate-${index + 1}`, item })),
    fallbackModel: model,
    model,
    subject,
  });

  const probability = run.probabilities[position] ?? 0;

  return {
    data: { reuse: probability >= LIBRARY_IDENTITY_MIN_PROBABILITY },
    probabilities: { true: probability },
    systemPrompt: getLibraryIdentityQuestion({ kind: subject.kind, position }).instructions,
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
