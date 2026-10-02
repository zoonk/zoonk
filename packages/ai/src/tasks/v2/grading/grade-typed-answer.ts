import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import systemPrompt from "./grade-typed-answer.prompt.md";
import { type TypedAnswerMatch, matchTypedAnswer } from "./typed-answer-match";

/**
 * Learners wait for the verdict. In the typed-grading eval (8 cases, Sep 2026)
 * Flash Lite, Luna and Haiku matched every teacher verdict and key point, and
 * Flash Lite was fastest (1.2s p50 against Luna's 2.2s).
 */
const defaultModel = "google/gemini-3.5-flash-lite";
const fallbackModels = ["openai/gpt-6-luna", "anthropic/claude-haiku-4.5"] as const;

const schema = z.object({
  feedback: z.string(),
  keyPoints: z.array(z.object({ met: z.boolean(), number: z.number().int() })),
});

/**
 * How the verdict was reached: code matched an accepted answer exactly or
 * with a spelling slip, or a model graded the key points.
 */
export type TypedAnswerGradeMethod = "exact" | "typo" | "model";

export type TypedAnswerGrade = {
  isCorrect: boolean;
  /** Share of key points met, from 0 to 1: partial credit for open answers. */
  score: number;
  keyPoints: { text: string; met: boolean }[];
  /** Null when code matched the answer, since there is nothing to explain. */
  feedback: string | null;
  method: TypedAnswerGradeMethod;
  /**
   * The accepted answer as spelled, when this answer only differs from it by a slip or a missing
   * accent; null otherwise. With `spellingMatters` the model still decides whether the slip
   * changed the word's form, so a grade can have a spelling and still be wrong.
   */
  spelling: string | null;
};

export type GradeTypedAnswerParams = {
  question: string;
  /** What a full answer must state, one idea each. */
  keyPoints: string[];
  /** Short canonical answers compared in code before any model runs. */
  acceptedAnswers?: string[];
  sampleAnswer?: string | null;
  answer: string;
  /** The learner's language, used for the feedback. */
  language: string;
  /** Language practice: a spelling that changes a word's form is a mistake, not a slip. */
  spellingMatters?: boolean;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function toGrade({
  feedback,
  keyPoints,
  match,
  method,
  metNumbers,
}: {
  feedback: string | null;
  keyPoints: string[];
  match: TypedAnswerMatch;
  method: TypedAnswerGradeMethod;
  metNumbers: ReadonlySet<number>;
}): TypedAnswerGrade {
  const graded = keyPoints.map((text, index) => ({ met: metNumbers.has(index + 1), text }));
  const metCount = graded.filter((keyPoint) => keyPoint.met).length;

  return {
    feedback,
    isCorrect: graded.length > 0 && metCount === graded.length,
    keyPoints: graded,
    method,
    score: graded.length === 0 ? 0 : metCount / graded.length,
    spelling: match.kind === "typo" ? match.acceptedAnswer : null,
  };
}

function formatKeyPoints(keyPoints: string[]): string {
  return keyPoints.map((keyPoint, index) => `${index + 1}. ${keyPoint}`).join("\n");
}

function buildUserPrompt(params: GradeTypedAnswerParams): string {
  const answerBlock = formatUntrustedInput({ LEARNER_ANSWER: params.answer });

  return `
    LANGUAGE: ${getPromptLanguageName({ language: params.language })}
    SPELLING_MATTERS: ${params.spellingMatters ? "yes" : "no"}
    QUESTION: ${params.question}
    KEY_POINTS:
${formatKeyPoints(params.keyPoints)}
    ACCEPTED_ANSWERS: ${(params.acceptedAnswers ?? []).join(" | ") || "none"}
    SAMPLE_ANSWER: ${params.sampleAnswer ?? "none"}

${answerBlock}
  `;
}

/**
 * Code settles the answers it can: an exact match is always right, and a
 * spelling slip is right unless the learner is practicing spelling itself.
 */
function getCodeMethod({
  match,
  spellingMatters,
}: {
  match: TypedAnswerMatch;
  spellingMatters?: boolean;
}): TypedAnswerGradeMethod | null {
  if (match.kind === "exact") {
    return "exact";
  }

  return match.kind === "typo" && !spellingMatters ? "typo" : null;
}

/**
 * Grades a typed or spoken (transcribed) answer against its key points. Code
 * compares it with the accepted answers first, so easy cases never call a
 * model; otherwise a fast model marks each key point met or not and writes
 * feedback that explains the verdict. Partial answers get partial credit.
 */
export async function gradeTypedAnswer(params: GradeTypedAnswerParams) {
  const { analytics, keyPoints, model = defaultModel, reasoning, useFallback = true } = params;

  const userPrompt = buildUserPrompt(params);

  const match = matchTypedAnswer({
    acceptedAnswers: params.acceptedAnswers ?? [],
    answer: params.answer,
  });

  const codeMethod = getCodeMethod({ match, spellingMatters: params.spellingMatters });

  if (codeMethod) {
    const allMet = new Set(keyPoints.map((_, index) => index + 1));

    return {
      data: toGrade({ feedback: null, keyPoints, match, metNumbers: allMet, method: codeMethod }),
      provenance: null,
      systemPrompt,
      usage: null,
      userPrompt,
    };
  }

  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
        temperature: 0,
      }),
    systemPrompt,
    task: "grade-typed-answer",
  });

  const metNumbers = new Set(
    result.output.keyPoints.filter((keyPoint) => keyPoint.met).map((keyPoint) => keyPoint.number),
  );

  return {
    data: toGrade({
      feedback: result.output.feedback,
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
