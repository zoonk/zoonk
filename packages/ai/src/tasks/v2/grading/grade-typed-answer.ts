import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { decodeHtmlEntities } from "../../_utils/html-entities";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import languagePracticePrompt from "./grade-typed-answer-language-practice.prompt.md";
import basePrompt from "./grade-typed-answer.prompt.md";
import {
  type TypedAnswerMatch,
  matchTypedAnswer,
  normalizeTypedAnswer,
} from "./typed-answer-match";

/**
 * Told to decide each key point from the answer's own words, Haiku claimed 1 to 2 key points the
 * answer never stated and got 39 of 40 verdicts right at 2s p50; Flash Lite claimed 7 to 8 (26 Oct
 * 2026). Haiku also costs less per answer.
 */
const defaultModel = "anthropic/claude-haiku-5.5";
const fallbackModels = ["openai/gpt-6-luna", "google/gemini-3.5-flash-lite"] as const;
const INCOMPLETE_GRADE_MESSAGE = "AI provider didn't grade every key point of a typed answer";

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the model judges the whole answer before its key points can read as a checklist, then each key point from the answer's own words, and writes the feedback last, so it says that verdict. */
const keyPointsSchema = z.array(z.object({ number: z.number().int(), met: z.boolean() }));

const schema = z.object({
  isCorrect: z.boolean(),
  keyPoints: keyPointsSchema,
  feedback: z.string(),
});

const languagePracticeSchema = z.object({
  isCorrect: z.boolean(),
  keyPoints: keyPointsSchema,
  corrections: z.array(z.object({ wrong: z.string(), right: z.string() })),
  feedback: z.string(),
});
/* oxlint-enable eslint/sort-keys */

type ModelGrade = z.infer<typeof schema> & { corrections?: TypedAnswerCorrection[] };

const languagePracticeSystemPrompt = `${basePrompt}\n${languagePracticePrompt}`;

export type TypedAnswerCorrection = { wrong: string; right: string };

/** `typo`: a spelling slip; `rounded`: a number rounded to the places typed. */
export type TypedAnswerGradeMethod = "exact" | "typo" | "rounded" | "model";

export type TypedAnswerGrade = {
  /**
   * In language practice, no form mistake may be left. A right answer may leave out a key point
   * that was only a detail.
   */
  isCorrect: boolean;
  /** Full credit for a code match; otherwise the share of key points met, 0 to 1. */
  score: number;
  /** Judged by meaning; null when code matched the answer without judging its ideas. */
  keyPoints: { text: string; met: boolean }[] | null;
  /** Language practice only; empty otherwise. */
  corrections: TypedAnswerCorrection[];
  /** Null when code matched the answer, since there is nothing to explain. */
  feedback: string | null;
  method: TypedAnswerGradeMethod;
  /**
   * In language practice the model still decides whether a slip changed the word's form, so a
   * grade can have a spelling and still be wrong.
   */
  spelling: string | null;
};

export type GradeTypedAnswerParams = {
  question: string;
  keyPoints: string[];
  /** Compared in code before any model runs. */
  acceptedAnswers?: string[];
  sampleAnswer?: string | null;
  answer: string;
  language: string;
  /**
   * The language the answer is written in, whatever the key points' language. Set only in language
   * practice, where a spelling that changes a word's form is a mistake, not a slip.
   */
  practicedLanguage?: string | null;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function toGrade({
  corrections,
  feedback,
  isCorrect,
  keyPoints,
  match,
  method,
  metNumbers,
}: {
  corrections: TypedAnswerCorrection[];
  feedback: string | null;
  isCorrect: boolean;
  keyPoints: string[];
  match: TypedAnswerMatch;
  method: TypedAnswerGradeMethod;
  metNumbers: ReadonlySet<number>;
}): TypedAnswerGrade {
  const graded = keyPoints.map((text, index) => ({ met: metNumbers.has(index + 1), text }));
  const metCount = graded.filter((keyPoint) => keyPoint.met).length;

  return {
    corrections,
    feedback,
    isCorrect: isCorrect && corrections.length === 0,
    keyPoints: graded,
    method,
    score: graded.length === 0 ? 0 : metCount / graded.length,
    spelling: match.kind === "typo" ? match.acceptedAnswer : null,
  };
}

/** Code already ignores case, spacing and punctuation, so a correction of only those isn't one. */
function changesTheAnswer(correction: TypedAnswerCorrection): boolean {
  return normalizeTypedAnswer(correction.wrong) !== normalizeTypedAnswer(correction.right);
}

function getFormCorrections({
  corrections,
  practicedLanguage,
}: {
  corrections: TypedAnswerCorrection[];
  practicedLanguage?: string | null;
}): TypedAnswerCorrection[] {
  return practicedLanguage ? corrections.filter((correction) => changesTheAnswer(correction)) : [];
}

/**
 * A grade that leaves a key point without a verdict (or grades one twice) didn't grade the answer:
 * reading the missing ones as not met would call a right answer wrong and save it as a mistake.
 */
function gradesEveryKeyPoint({
  graded,
  keyPointCount,
}: {
  graded: readonly { number: number }[];
  keyPointCount: number;
}): boolean {
  const numbers = new Set(graded.map((keyPoint) => keyPoint.number));

  return (
    graded.length === keyPointCount &&
    numbers.size === keyPointCount &&
    [...numbers].every((number) => number >= 1 && number <= keyPointCount)
  );
}

function formatKeyPoints(keyPoints: string[]): string {
  return keyPoints.map((keyPoint, index) => `${index + 1}. ${keyPoint}`).join("\n");
}

function buildUserPrompt(params: GradeTypedAnswerParams): string {
  const answerBlock = formatUntrustedInput({ LEARNER_ANSWER: params.answer });

  const practiced = params.practicedLanguage
    ? `\n    PRACTICED_LANGUAGE: ${getPromptLanguageName({ language: params.practicedLanguage, userLanguage: params.language })}`
    : "";

  return `
    FEEDBACK_LANGUAGE: ${getPromptLanguageName({ language: params.language })}${practiced}
    QUESTION: ${params.question}
    KEY_POINTS:
${formatKeyPoints(params.keyPoints)}
    ACCEPTED_ANSWERS: ${(params.acceptedAnswers ?? []).join(" | ") || "none"}
    SAMPLE_ANSWER: ${params.sampleAnswer ?? "none"}

${answerBlock}
  `;
}

/**
 * A spelling slip or a rounded number is right unless the learner is practicing a language, where
 * writing the word or the number heard is the skill itself.
 */
function getCodeMethod({
  match,
  practicedLanguage,
}: {
  match: TypedAnswerMatch;
  practicedLanguage?: string | null;
}): TypedAnswerGradeMethod | null {
  if (match.kind === "exact") {
    return "exact";
  }

  return match.kind === "none" || practicedLanguage ? null : match.kind;
}

/**
 * A grade that skips a key point throws instead of counting it as missed, so a grading failure
 * never reads as the learner's mistake.
 */
export async function gradeTypedAnswer(params: GradeTypedAnswerParams) {
  const { analytics, keyPoints, model = defaultModel, reasoning, useFallback = true } = params;
  const systemPrompt = params.practicedLanguage ? languagePracticeSystemPrompt : basePrompt;
  const userPrompt = buildUserPrompt(params);

  const match = matchTypedAnswer({
    acceptedAnswers: params.acceptedAnswers ?? [],
    answer: params.answer,
  });

  const codeMethod = getCodeMethod({ match, practicedLanguage: params.practicedLanguage });

  if (codeMethod) {
    const data: TypedAnswerGrade = {
      corrections: [],
      feedback: null,
      isCorrect: true,
      keyPoints: null,
      method: codeMethod,
      score: 1,
      spelling: match.kind === "typo" ? match.acceptedAnswer : null,
    };

    return { data, provenance: null, systemPrompt, usage: null, userPrompt };
  }

  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object<ModelGrade>({
          schema: params.practicedLanguage ? languagePracticeSchema : schema,
        }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    systemPrompt,
    task: "grade-typed-answer",
  });

  if (!gradesEveryKeyPoint({ graded: result.output.keyPoints, keyPointCount: keyPoints.length })) {
    throw new Error(INCOMPLETE_GRADE_MESSAGE);
  }

  const metNumbers = new Set(
    result.output.keyPoints.filter((keyPoint) => keyPoint.met).map((keyPoint) => keyPoint.number),
  );

  return {
    data: toGrade({
      corrections: getFormCorrections({
        corrections: result.output.corrections ?? [],
        practicedLanguage: params.practicedLanguage,
      }),
      feedback: decodeHtmlEntities(result.output.feedback),
      isCorrect: result.output.isCorrect,
      keyPoints,
      match,
      metNumbers,
      method: "model",
    }),
    provenance,
    systemPrompt,
    usage: result.usage,
    userPrompt,
  };
}
