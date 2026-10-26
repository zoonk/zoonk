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
 * Learners wait for the verdict. In the typed-grading eval (8 cases, Sep 2026)
 * Flash Lite, Luna and Haiku matched every teacher verdict and key point, and
 * Flash Lite was fastest (1.2s p50 against Luna's 2.2s). Flash Lite once wrote
 * HTML entities ("l&acirc;mpada") and mirrored a learner's missing accents; with
 * the prompt's writing rules it wrote correct Portuguese for unaccented answers
 * (14 cases, 5 Oct 2026: every verdict right, 1.7s p50 against Luna's 2.8s), and
 * code decodes any entity that still slips through. With key points judged by
 * meaning and form mistakes as corrections it got every verdict, key point and
 * correction right (7 cases, 7 Oct 2026, 1.4s p50), though it still wrote
 * Portuguese feedback without accents in 2 of them. Told only the feedback's
 * language, it once read it as the answer's and graded a right English answer
 * "0 of 3"; with the practiced language apart it got all 9 language-practice
 * cases right (7 Oct 2026, 1.3s p50), English answers to Portuguese key points
 * included. Claude Haiku 5.5 with thinking off missed 2 of 23 (Flash Lite 1), at
 * 1.7s p50 against 1.2s (7 Oct 2026). Deciding the key points before the feedback,
 * and meeting a key point that names a term with the learner's own words for it,
 * it got 8 sampled verdicts right, two right class-test answers it had marked
 * wrong for a missing term included (8 Oct 2026, 1.3s p50; one feedback without
 * an accent). Told that the learner never sees the key points, so one that says
 * to use a phrase the question doesn't ask for is met by another correct
 * wording, it got all 10 language-practice cases right, an own-words answer it
 * had graded "1 of 2" for a missing taught phrase included (11 Oct 2026, 1.2s p50).
 * Asked whether the answer shows the idea the question checks (a right answer
 * may leave out a detail), but after the key points, it still read them as a
 * checklist and called 4 of 20 right answers wrong, one naming the missing
 * cytoplasm and where it goes among them. Deciding the verdict first, it got 34
 * of 35 verdicts right in each of three runs, against Luna's 32 to 34 and Haiku's
 * 33 to 34 in two (26 Oct 2026, 1.3s p50 against Luna's 2.9 to 3.3s and Haiku's
 * 2.3 to 2.5s). But with the verdict first, it marked key points met to match it,
 * so learners read "Stated" for ideas they never wrote (10 of 108 key points, 26
 * Oct 2026). Told to decide each key point from the answer's own words, never the
 * verdict, Haiku claimed 1 to 2 (both arguable) and got 39 of 40 verdicts right
 * in two runs at 2s p50; Flash Lite still claimed 7 to 8, Luna 1 to 2 with 38 to
 * 40 verdicts at 2.9 to 3.3s p50. Haiku costs less than Flash Lite per answer.
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

/** Only language practice grades form, so only its answers list form mistakes. */
const languagePracticeSchema = z.object({
  isCorrect: z.boolean(),
  keyPoints: keyPointsSchema,
  corrections: z.array(z.object({ wrong: z.string(), right: z.string() })),
  feedback: z.string(),
});
/* oxlint-enable eslint/sort-keys */

type ModelGrade = z.infer<typeof schema> & { corrections?: TypedAnswerCorrection[] };

/**
 * Language practice reads its rules (the practiced language, form mistakes as corrections) after
 * the shared ones; every other answer gets the shared rules alone, so its prompt never carries them.
 */
const languagePracticeSystemPrompt = `${basePrompt}\n${languagePracticePrompt}`;

/** A language form mistake in the answer: the learner's words as written and how to write them. */
export type TypedAnswerCorrection = { wrong: string; right: string };

/**
 * How the verdict was reached: code matched an accepted answer exactly, with a
 * spelling slip or as a number rounded to the places typed, or a model graded
 * the answer.
 */
export type TypedAnswerGradeMethod = "exact" | "typo" | "rounded" | "model";

export type TypedAnswerGrade = {
  /**
   * The answer shows the understanding the question asks for, and in language practice has no
   * form mistake left. A right answer may leave out a key point that was only a detail.
   */
  isCorrect: boolean;
  /** Full credit for a code match; otherwise the share of key points met, from 0 to 1. */
  score: number;
  /** Judged by meaning; null when code matched the answer without judging its ideas. */
  keyPoints: { text: string; met: boolean }[] | null;
  /** Language practice only: each form mistake, so the learner sees what to fix. Empty otherwise. */
  corrections: TypedAnswerCorrection[];
  /** Null when code matched the answer, since there is nothing to explain. */
  feedback: string | null;
  method: TypedAnswerGradeMethod;
  /**
   * The accepted answer as spelled, when this answer only differs from it by a slip or a missing
   * accent; null otherwise. In language practice the model still decides whether the slip
   * changed the word's form, so a grade can have a spelling and still be wrong.
   */
  spelling: string | null;
};

export type GradeTypedAnswerParams = {
  question: string;
  /** What a full answer states, one idea each: the grader's guide to the verdict. */
  keyPoints: string[];
  /** Short canonical answers compared in code before any model runs. */
  acceptedAnswers?: string[];
  sampleAnswer?: string | null;
  answer: string;
  /** The learner's language: the question and key points are written in it, and the feedback. */
  language: string;
  /**
   * Language practice: the language the learner writes the answer in ("en" for a Portuguese
   * speaker learning English), whatever language the key points are written in. A spelling that
   * changes a word's form is a mistake there, not a slip. Unset outside language practice.
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

/**
 * Code already treats case, spacing and punctuation as the same answer, so a correction that only
 * changes those ("thursday" to "Thursday") isn't a mistake, nor is one that changes nothing.
 */
function changesTheAnswer(correction: TypedAnswerCorrection): boolean {
  return normalizeTypedAnswer(correction.wrong) !== normalizeTypedAnswer(correction.right);
}

/** Only language practice grades form, so corrections elsewhere are dropped. */
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
 * Code settles the answers it can: an exact match is always right, and a
 * spelling slip or a rounded number is right unless the learner is practicing
 * a language, where writing the word or the number heard is the skill itself.
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
 * Grades a typed or spoken (transcribed) answer. Code compares it with the
 * accepted answers first, so easy cases never call a model; otherwise a fast
 * model decides whether the answer shows the understanding the question asks
 * for (a right answer can leave out a detail), marks each key point met or not,
 * and writes feedback that explains the verdict and names what a right answer
 * could add. The share of key points met is partial credit. In language
 * practice key points are still judged by meaning (an English answer meets a
 * key point written in Portuguese), and each form mistake comes back as a
 * correction that keeps the answer from being right. A grade that skips a key
 * point throws instead of counting it as missed, so a grading failure never
 * reads as the learner's mistake.
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
