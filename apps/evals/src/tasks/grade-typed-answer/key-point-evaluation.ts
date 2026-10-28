import { evaluateQuestions } from "@zoonk/ai/evaluate/evaluate-questions";
import {
  type GradeTypedAnswerParams,
  type TypedAnswerGrade,
  gradeTypedAnswer,
} from "@zoonk/ai/tasks/v2/grading/grade-typed-answer";
import { matchTypedAnswer } from "@zoonk/ai/tasks/v2/grading/typed-answer-match";

const INSTRUCTIONS = `Decide whether LEARNER_ANSWER states the key point below as an answer to QUESTION.
The key point is met when the answer states its idea in any wording, including synonyms, paraphrases, everyday words and examples that clearly show it. It is not met when the answer leaves it out, stays too vague, only repeats the question or contradicts it. Judge meaning, not grammar, and ignore spelling slips.`;

const VERDICT_QUESTION = {
  criteria: {
    false:
      "The answer misses or gets wrong the idea the question checks, states something false, stays too vague or only repeats the question.",
    true: "The answer shows the idea the question checks, even if it leaves out a detail or another part.",
  },
  instructions: `Decide whether LEARNER_ANSWER shows that the learner understands what QUESTION checks, like a fair teacher who checks understanding, not wording. It can leave out a place or a detail, one of several reasons, a second thing the question also asks about, or a reason that follows from what it already says. It is wrong when it misses or gets wrong the idea the question checks (only a choice or a result with no reason when the question asks why, only what goes into a process when it asks what happens), states something false, contradicts itself, stays too vague or only repeats the question.`,
  type: "boolean" as const,
};

const FORM_QUESTION = {
  criteria: {
    false: "The answer has at least one form mistake.",
    true: "The answer has no form mistake.",
  },
  instructions: `The learner is practicing a language. Decide whether LEARNER_ANSWER is free of form mistakes: a wrong word ("you" for "your") or a spelling or form that changes a word's meaning, gender, number, tense or agreement. Slips that don't change which word was meant, capital letters and punctuation are not mistakes.`,
  type: "boolean" as const,
};

const EVAL_THRESHOLD = 0.5;

const NO_USAGE = { inputTokens: 0, outputTokens: 0 };

function buildQuestions({
  keyPoints,
  practicedLanguage,
}: Pick<GradeTypedAnswerParams, "keyPoints" | "practicedLanguage">): Record<
  string,
  typeof VERDICT_QUESTION
> {
  const keyPointQuestions = Object.fromEntries(
    keyPoints.map((keyPoint, index) => [
      `keyPoint${index + 1}`,
      {
        criteria: {
          false: "The answer leaves this key point out, is too vague or contradicts it.",
          true: "The answer clearly states this key point.",
        },
        instructions: `${INSTRUCTIONS}\n\nKEY_POINT: ${keyPoint}`,
        type: "boolean" as const,
      },
    ]),
  );

  const questions = { ...keyPointQuestions, isRight: VERDICT_QUESTION };
  return practicedLanguage ? { ...questions, formIsRight: FORM_QUESTION } : questions;
}

function toGrade({
  formIsRight,
  isRight,
  keyPoints,
  met,
  spelling,
}: {
  formIsRight: boolean;
  isRight: boolean;
  keyPoints: string[];
  met: boolean[];
  spelling: string | null;
}): TypedAnswerGrade {
  const graded = keyPoints.map((text, index) => ({ met: met[index] ?? false, text }));
  const metCount = graded.filter((keyPoint) => keyPoint.met).length;

  return {
    corrections: [],
    feedback: null,
    isCorrect: isRight && formIsRight,
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

  if (match.kind === "exact" || (match.kind !== "none" && !input.practicedLanguage)) {
    const { data } = await gradeTypedAnswer(input);
    return { data, systemPrompt: INSTRUCTIONS, usage: NO_USAGE, userPrompt: input.answer };
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

  const formIsRight = (run.answers.formIsRight?.probability ?? 1) >= EVAL_THRESHOLD;
  const isRight = (run.answers.isRight?.probability ?? 0) >= EVAL_THRESHOLD;

  return {
    data: toGrade({
      formIsRight,
      isRight,
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
