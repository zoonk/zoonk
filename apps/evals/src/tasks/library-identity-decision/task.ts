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
