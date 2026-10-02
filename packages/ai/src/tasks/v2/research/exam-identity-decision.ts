import "server-only";
import { decideBoolean } from "../../../evaluate/decisions";
import { evaluateQuestions } from "../../../evaluate/evaluate-questions";
import { JEV_MODEL_ID } from "../../../evaluate/evaluation-models";
import decisionPrompt from "./exam-identity-decision.prompt.md";

/** The cutoff the Library identity decisions start from; the exam eval can move it. */
const MIN_PROBABILITY = 0.6;
const FALLBACK_EVALUATION_MODEL = "openai/gpt-6-luna";

/** The decision's instructions, so evals show what the models were asked. */
export const EXAM_IDENTITY_INSTRUCTIONS: string = decisionPrompt;

/** How an exam is described to the decision: never a learner's personal details. */
export type ExamDescription = {
  board: string | null;
  country: string;
  name: string;
  role: string | null;
};

const SAME_EXAM_QUESTION = {
  same: {
    criteria: {
      false: "A different organizer, agency, role, level or country.",
      true: "The same exam and role, possibly under another name or year.",
    },
    instructions: decisionPrompt,
    type: "boolean",
  },
} as const;

/** Only the identifying fields, in one order, so both sides read alike. */
function describeExam(exam: ExamDescription): ExamDescription {
  return { board: exam.board, country: exam.country, name: exam.name, role: exam.role };
}

/**
 * Asks whether one stored exam is the requested one. Both sides are data
 * inside delimiters, so a name claiming "same exam" can't move the verdict.
 */
export async function evaluateExamIdentityPair({
  candidate,
  model = JEV_MODEL_ID,
  request,
}: {
  candidate: ExamDescription;
  model?: string;
  request: ExamDescription;
}) {
  const { answers, ...run } = await evaluateQuestions({
    fallbackModel: FALLBACK_EVALUATION_MODEL,
    input: {
      CANDIDATE: JSON.stringify(describeExam(candidate)),
      REQUEST: JSON.stringify(describeExam(request)),
    },
    // Only shared blueprints are compared, and their names are stored with them.
    keepInput: true,
    model,
    questions: SAME_EXAM_QUESTION,
    task: "exam-identity-decision",
  });

  return { ...run, probability: answers.same.probability };
}

/** Whether a pair's probability reaches the reuse threshold. */
export function isSameExam(probability: number): boolean {
  return decideBoolean({ probability, threshold: MIN_PROBABILITY });
}

/**
 * Picks the stored exam most likely to be the requested one, when one reaches
 * the threshold, so "Exame Nacional do Ensino Médio" and "ENEM" share one
 * blueprint. Each candidate is judged on its own, in parallel.
 */
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
