import { evaluateQuestions } from "@zoonk/ai/evaluate/evaluate-questions";
import {
  type GradeTypedAnswerParams,
  type TypedAnswerGrade,
} from "@zoonk/ai/tasks/v2/grading/grade-typed-answer";
import { matchTypedAnswer } from "@zoonk/ai/tasks/v2/grading/typed-answer-match";

/**
 * The plan's Jev use for open answers: one boolean question per key point
 * after the same code pre-check production runs. It returns the task's own
 * output shape so the typed-grading scorer compares it with generation models.
 */
const INSTRUCTIONS = `Decide whether LEARNER_ANSWER states the key point below as an answer to QUESTION.
The key point is met when the answer states its idea in any wording, including synonyms, paraphrases, everyday words and examples that clearly show it. It is not met when the answer leaves it out, stays too vague, only repeats the question or contradicts it. Judge meaning, not grammar, and ignore spelling slips.`;

const SPELLING_RULE =
  "The learner is practicing a language: a form that changes the word's meaning, gender, number, tense or agreement does not meet the key point.";

const EVAL_THRESHOLD = 0.5;

const NO_USAGE = { inputTokens: 0, outputTokens: 0 };

function buildQuestions({
  keyPoints,
  spellingMatters,
}: Pick<GradeTypedAnswerParams, "keyPoints" | "spellingMatters">) {
  const instructions = spellingMatters ? `${INSTRUCTIONS}\n${SPELLING_RULE}` : INSTRUCTIONS;

  return Object.fromEntries(
    keyPoints.map((keyPoint, index) => [
      `keyPoint${index + 1}`,
      {
        criteria: {
          false: "The answer leaves this key point out, is too vague or contradicts it.",
          true: "The answer clearly states this key point.",
        },
        instructions: `${instructions}\n\nKEY_POINT: ${keyPoint}`,
        type: "boolean" as const,
      },
    ]),
  );
}

function toGrade({
  keyPoints,
  met,
  spelling,
}: {
  keyPoints: string[];
  met: boolean[];
  spelling: string | null;
}): TypedAnswerGrade {
  const graded = keyPoints.map((text, index) => ({ met: met[index] ?? false, text }));
  const metCount = graded.filter((keyPoint) => keyPoint.met).length;

  return {
    feedback: null,
    isCorrect: metCount === graded.length,
    keyPoints: graded,
    method: "model",
    score: metCount / graded.length,
    spelling,
  };
}

export async function evaluateTypedAnswerKeyPoints(
  input: GradeTypedAnswerParams & { model: string },
) {
  const match = matchTypedAnswer({
    acceptedAnswers: input.acceptedAnswers ?? [],
    answer: input.answer,
  });

  const spelling = match.kind === "typo" ? match.acceptedAnswer : null;

  if (match.kind === "exact" || (match.kind === "typo" && !input.spellingMatters)) {
    return {
      data: toGrade({ keyPoints: input.keyPoints, met: input.keyPoints.map(() => true), spelling }),
      systemPrompt: INSTRUCTIONS,
      usage: NO_USAGE,
      userPrompt: input.answer,
    };
  }

  const run = await evaluateQuestions({
    input: {
      LEARNER_ANSWER: input.answer,
      QUESTION: input.question,
      SAMPLE_ANSWER: input.sampleAnswer ?? "none",
    },
    model: input.model,
    questions: buildQuestions(input),
    task: "grade-typed-answer",
  });

  const probabilities = input.keyPoints.map(
    (_, index) => run.answers[`keyPoint${index + 1}`]?.probability ?? 0,
  );

  return {
    data: toGrade({
      keyPoints: input.keyPoints,
      met: probabilities.map((probability) => probability >= EVAL_THRESHOLD),
      spelling,
    }),
    probabilities: Object.fromEntries(
      probabilities.map((value, index) => [`keyPoint${index + 1}`, value]),
    ),
    systemPrompt: INSTRUCTIONS,
    usage: run.usage,
    userPrompt: run.state,
  };
}
