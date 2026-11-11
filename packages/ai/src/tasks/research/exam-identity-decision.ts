import "server-only";
import { decideBoolean } from "../../evaluate/decisions";
import { evaluateQuestions } from "../../evaluate/evaluate-questions";
import decisionPrompt from "./exam-identity-decision.prompt.md";

/** The Library identity decisions' cutoff; the exam eval can move it. */
const MIN_PROBABILITY = 0.6;

/**
 * At this cutoff on 14 cases (8 Nov 2026), Decider Flash V1.2 and Mammoth got every pair right (EN
 * 3/3, PT 10/10) at $0.0050 and $0.0506 per 1k decisions; Jev ($0.0299) took a stored exam with no
 * phase for the first phase.
 */
const EVALUATION_MODEL = "perplexity/pplx-decider-flash-v1.2";
const FALLBACK_EVALUATION_MODEL = "baseten/mammoth-1";

export const EXAM_IDENTITY_INSTRUCTIONS: string = decisionPrompt;

/** Never a learner's personal details. */
export type ExamDescription = {
  board: string | null;
  /** Null when nobody knows it; never filled in from a candidate. */
  country: string | null;
  name: string;
  role: string | null;
};

const SAME_EXAM_QUESTION = {
  same: {
    criteria: {
      false: "A different organizer, agency, role, phase, level or country.",
      true: "The same exam, role and phase, possibly under another name or year.",
    },
    instructions: decisionPrompt,
    type: "boolean",
  },
} as const;

/** Only the identifying fields, in one order, so both sides read alike. */
function describeExam(exam: ExamDescription): ExamDescription {
  return { board: exam.board, country: exam.country, name: exam.name, role: exam.role };
}

/** Each side as its own data, so an unknown country stays unknown rather than the other side's. */
export function formatExamIdentityInput({
  candidate,
  request,
}: {
  candidate: ExamDescription;
  request: ExamDescription;
}): { CANDIDATE: string; REQUEST: string } {
  return {
    CANDIDATE: JSON.stringify(describeExam(candidate)),
    REQUEST: JSON.stringify(describeExam(request)),
  };
}

/** Both sides are delimited data, so a name claiming "same exam" can't move the verdict. */
export async function evaluateExamIdentityPair({
  candidate,
  model = EVALUATION_MODEL,
  request,
}: {
  candidate: ExamDescription;
  model?: string;
  request: ExamDescription;
}) {
  const { answers, ...run } = await evaluateQuestions({
    fallbackModel: FALLBACK_EVALUATION_MODEL,
    input: formatExamIdentityInput({ candidate, request }),
    // Only shared blueprints are compared, and their names are stored with them.
    keepInput: true,
    model,
    questions: SAME_EXAM_QUESTION,
    task: "exam-identity-decision",
  });

  return { ...run, probability: answers.same.probability };
}

export function isSameExam(probability: number): boolean {
  return decideBoolean({ probability, threshold: MIN_PROBABILITY });
}

/** So "Exame Nacional do Ensino Médio" and "ENEM" share one blueprint. */
export async function decideExamIdentity({
  candidates,
  request,
}: {
  candidates: (ExamDescription & { id: string })[];
  request: ExamDescription;
}): Promise<{ id: string; probability: number } | null> {
  const verdicts = await Promise.all(
    candidates.map(async (candidate) => {
      const run = await evaluateExamIdentityPair({ candidate, request });
      return { id: candidate.id, probability: run.probability };
    }),
  );

  const [match] = verdicts
    .filter((verdict) => isSameExam(verdict.probability))
    .toSorted((first, second) => second.probability - first.probability);

  return match ? { id: match.id, probability: match.probability } : null;
}
