import "server-only";
import { decideBoolean } from "../../../evaluate/decisions";
import { type EvaluationRunDetails, evaluateQuestions } from "../../../evaluate/evaluate-questions";
import { JEV_MODEL_ID } from "../../../evaluate/evaluation-models";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import decisionPrompt from "./library-identity-decision.prompt.md";
import {
  type LibraryIdentityCandidate,
  type LibraryIdentityKind,
  type LibraryIdentitySubject,
  formatIdentityItem,
  formatIdentitySubject,
} from "./library-identity-subject";

/** The cutoff from the `library-identity-decision` eval's probabilities. */
export const LIBRARY_IDENTITY_MIN_PROBABILITY = 0.6;

/** The eval's runner-up, used when Jev errors, times out or can't fit the input. */
const FALLBACK_EVALUATION_MODEL = "openai/gpt-6-luna";

const REUSE_CRITERIA: Readonly<Record<LibraryIdentityKind, { false: string; true: string }>> = {
  chapter: {
    false:
      "It covers other, broader or narrower objectives, a different level or language, or only belongs to courses on another subject.",
    true: "The candidate chapter covers the requested objectives at the requested level for this goal, in a course on the requested course's subject.",
  },
  course: {
    false: "It is a broader, narrower or neighboring subject, or a different language.",
    true: "The candidate course is the same subject as the requested course, only named differently.",
  },
  image: {
    false: "It shows a different object, scene or concept, or would mislead in this context.",
    true: "The candidate image shows what the requested image needs to show for this purpose.",
  },
  lesson: {
    false:
      "It teaches other, broader or narrower skills, a different level or language, or only belongs to courses on another subject.",
    true: "The candidate lesson teaches the requested skills at the requested level for this goal, in a course on the requested course's subject.",
  },
  researchSource: {
    false:
      "It is about a neighboring topic, another country or version, or it is a summary, a seller's page or a forum instead of an official document.",
    true: "The candidate is a current official document of the requested kind about exactly the requested topic.",
  },
  skill: {
    false:
      "It is a different action, a broader or narrower ability, only on the same topic, or only belongs to courses on another subject.",
    true: "The candidate skill is the same thing a learner can do, only worded differently, in a course on the requested course's subject when one is named.",
  },
  source: {
    false: "It is a different document, edition or year, or a summary of the document.",
    true: "The candidate is the same document, edition and publisher as the requested source.",
  },
};

export type LibraryIdentityVerdict = {
  id: string;
  /** P(the candidate can replace the request), as the model estimated it. */
  probability: number;
  /** The model that answered, which is the fallback when Jev failed. */
  model: string;
};

/** The field that holds the candidate at this position (from 0) in the state the model reads. */
function toCandidateField(position: number): string {
  return `CANDIDATE_${position + 1}`;
}

/**
 * The yes-or-no reuse question about the candidate at one position, shared by production and
 * evals. Each question names its candidate, since the state holds every candidate of the request.
 */
export function getLibraryIdentityQuestion({
  kind,
  position,
}: {
  kind: LibraryIdentityKind;
  position: number;
}) {
  return {
    criteria: REUSE_CRITERIA[kind],
    instructions: `${decisionPrompt}\nThis question is about ${toCandidateField(position)} only.`,
    type: "boolean",
  } as const;
}

/**
 * Asks whether each candidate can replace the requested item, in one evaluation call: the state
 * holds the request and every candidate, and each candidate gets its own question, which Jev
 * answers independently. One call per request instead of one per candidate keeps a big plan's
 * thousands of verdicts under the gateway's request limit (a public-service exam's outlines asked
 * for about 14,000 in eight minutes, over the 3,000 a minute the team may send). Both sides are
 * data inside delimiters: titles and goals come from models and learners, and a line claiming
 * "same lesson" must not move a verdict. Returns each candidate's probability, in order.
 */
export async function evaluateLibraryIdentityCandidates({
  analytics,
  candidates,
  fallbackModel = FALLBACK_EVALUATION_MODEL,
  model = JEV_MODEL_ID,
  subject,
}: {
  analytics?: AiGenerationContext;
  candidates: readonly LibraryIdentityCandidate[];
  fallbackModel?: string;
  model?: string;
  subject: LibraryIdentitySubject;
}): Promise<EvaluationRunDetails & { probabilities: number[] }> {
  const fields: Record<string, string> = Object.fromEntries(
    candidates.map((candidate, position) => [
      toCandidateField(position),
      formatIdentityItem(candidate.item),
    ]),
  );

  const questions = Object.fromEntries(
    candidates.map((_, position) => [
      toCandidateField(position),
      getLibraryIdentityQuestion({ kind: subject.kind, position }),
    ]),
  );

  const { answers, ...run } = await evaluateQuestions({
    analytics,
    fallbackModel,
    input: { REQUEST: formatIdentitySubject(subject), ...fields },
    // Only shared Library items are compared, and the goal is only its shareable part.
    keepInput: true,
    model,
    questions,
    task: "library-identity-decision",
  });

  const probabilities = candidates.map(
    (_, position) => answers[toCandidateField(position)]?.probability ?? 0,
  );

  return { ...run, probabilities };
}

/**
 * Picks the candidate most likely to replace the request, when one reaches the threshold, from
 * one evaluation of every candidate (see `evaluateLibraryIdentityCandidates`). `verdicts` keeps
 * each candidate's probability, for callers that reuse every candidate that fits.
 */
export async function decideLibraryIdentity({
  analytics,
  candidates,
  subject,
}: {
  analytics?: AiGenerationContext;
  candidates: LibraryIdentityCandidate[];
  subject: LibraryIdentitySubject;
}): Promise<{ match: LibraryIdentityVerdict | null; verdicts: LibraryIdentityVerdict[] }> {
  if (candidates.length === 0) {
    return { match: null, verdicts: [] };
  }

  const run = await evaluateLibraryIdentityCandidates({ analytics, candidates, subject });

  const verdicts = candidates.map((candidate, position) => ({
    id: candidate.id,
    model: run.model,
    probability: run.probabilities[position] ?? 0,
  }));

  const [match] = verdicts
    .filter(({ probability }) =>
      decideBoolean({ probability, threshold: LIBRARY_IDENTITY_MIN_PROBABILITY }),
    )
    .toSorted((first, second) => second.probability - first.probability);

  return { match: match ?? null, verdicts };
}
