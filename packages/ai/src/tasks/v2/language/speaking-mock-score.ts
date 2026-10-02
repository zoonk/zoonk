import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getLanguagePromptContext } from "../../_utils/prompt-language";
import {
  type ConversationTurn,
  formatConversationTranscript,
} from "./_utils/conversation-transcript";
import {
  type BandRange,
  SPEAKING_MOCK_CRITERIA,
  type SpeakingCriterion,
  type SpeakingMockExam,
  getMinRangeWidth,
  getOverallBand,
  normalizeBandRange,
} from "./speaking-mock-bands";
import systemPrompt from "./speaking-mock-score.prompt.md";

/**
 * Runs once per mock, and the learner waits for it on the results screen.
 * In the eval (transcripts labeled A2, B1 and C1, Sep 2026) Luna scored 8.90
 * at 7.7s p50 and $0.53 per 1k runs, with all 12 ranges within half a band of
 * the labels; Gemini 3.1 Flash Lite scored 6.83 at 3.0s on A2 and C1,
 * overrating the A2 candidate and quoting a word they never said. After the
 * prompt asked every criterion to quote the candidate and never to call
 * correct language an error (27 Sep), Luna scored 9.27 on two English and
 * 8.47 on three Portuguese learners, at 14.8s p50. With TOEFL added (27 Sep,
 * TOEFL transcripts labeled A2 to C1) it scored 8.90 on the six IELTS and
 * 8.93 on the four TOEFL cases at 13.4s p50 and $1.02 per 1k runs, every
 * range within half a band of its label; one English TOEFL case came back in
 * Japanese until the prompt said the learner language may be the exam's own.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash"] as const;

/** How the prompt names each exam, so the model follows that exam's rubric section. */
const EXAM_NAMES: Record<SpeakingMockExam, string> = {
  ielts: "IELTS Speaking",
  toefl: "TOEFL iBT Speaking",
};

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the evidence comes before the band it supports, the tip last, and each exam's criteria in the order its rubric lists them. */
const criterionSchema = z.object({
  evidence: z.string(),
  bandLow: z.number(),
  bandHigh: z.number(),
  tip: z.string(),
});

/** One key per criterion, so the model can't skip or repeat one. */
const ieltsSchema = z.object({
  fluencyCoherence: criterionSchema,
  lexicalResource: criterionSchema,
  grammar: criterionSchema,
  pronunciation: criterionSchema,
  focus: z.enum(SPEAKING_MOCK_CRITERIA.ielts),
});

const toeflSchema = z.object({
  repetition: criterionSchema,
  elaboration: criterionSchema,
  grammar: criterionSchema,
  vocabulary: criterionSchema,
  delivery: criterionSchema,
  focus: z.enum(SPEAKING_MOCK_CRITERIA.toefl),
});
/* oxlint-enable eslint/sort-keys */

type CriterionOutput = z.infer<typeof criterionSchema>;

type ExamScore<TExam extends SpeakingMockExam> = {
  criteria: (BandRange & { criterion: SpeakingCriterion<TExam>; evidence: string; tip: string })[];
  exam: TExam;
  focus: SpeakingCriterion<TExam>;
  /** The criteria's bands combined the way the exam reports its speaking score. */
  overall: BandRange;
};

export type ScoreSpeakingMockSchema = ExamScore<"ielts"> | ExamScore<"toefl">;

export type ScoreSpeakingMockParams = {
  exam: SpeakingMockExam;
  /** The examiner is the "character" and the candidate the "learner". Candidate turns are untrusted. */
  turns: ConversationTurn[];
  /** How long the candidate spoke in total. */
  spokenSeconds: number;
  targetLanguage: string;
  learnerLanguage: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/** Code keeps every range on the exam's scale, whatever numbers the model wrote. */
function toExamScore<TExam extends SpeakingMockExam>({
  exam,
  output,
}: {
  exam: TExam;
  output: Record<SpeakingCriterion<TExam>, CriterionOutput> & { focus: SpeakingCriterion<TExam> };
}): ExamScore<TExam> {
  const criteria = SPEAKING_MOCK_CRITERIA[exam].map((criterion: SpeakingCriterion<TExam>) => {
    const { bandHigh, bandLow, evidence, tip } = output[criterion];
    const minWidth = getMinRangeWidth({ criterion, exam });

    return {
      criterion,
      evidence,
      tip,
      ...normalizeBandRange({ bandHigh, bandLow, exam, minWidth }),
    };
  });

  return { criteria, exam, focus: output.focus, overall: getOverallBand({ criteria, exam }) };
}

function buildUserPrompt(params: ScoreSpeakingMockParams): string {
  const languages = getLanguagePromptContext({
    targetLanguage: params.targetLanguage,
    userLanguage: params.learnerLanguage,
  });

  const transcript = formatConversationTranscript({
    labels: { character: "EXAMINER", learner: "CANDIDATE" },
    turns: params.turns,
  });

  return `
    EXAM: ${EXAM_NAMES[params.exam]}
    TARGET_LANGUAGE: ${languages.targetLanguageName}
    LEARNER_LANGUAGE: ${languages.userLanguageName}
    CANDIDATE_SPOKEN_SECONDS: ${Math.round(params.spokenSeconds)}

${formatUntrustedInput({ TRANSCRIPT: transcript })}
  `;
}

function generateScore<TOutput>({
  params,
  schema,
  userPrompt,
}: {
  params: ScoreSpeakingMockParams;
  schema: z.ZodType<TOutput>;
  userPrompt: string;
}) {
  const { analytics, model = defaultModel, reasoning, useFallback = true } = params;
  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  return runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    systemPrompt,
    task: "speaking-mock-score",
  });
}

async function scoreExam(params: ScoreSpeakingMockParams, userPrompt: string) {
  if (params.exam === "toefl") {
    const { provenance, result } = await generateScore({ params, schema: toeflSchema, userPrompt });
    return { data: toExamScore({ exam: "toefl", output: result.output }), provenance, result };
  }

  const { provenance, result } = await generateScore({ params, schema: ieltsSchema, userPrompt });
  return { data: toExamScore({ exam: "ielts", output: result.output }), provenance, result };
}

/**
 * Estimates a speaking mock by the exam's own criteria (IELTS's four, or
 * TOEFL's Listen and Repeat accuracy and its interview criteria): a band
 * range for each with the candidate's own words as evidence, one concrete tip
 * each, the criterion to practice next, and the overall range the exam's way.
 * The ranges are estimates from a transcript, never an official score.
 */
export async function scoreSpeakingMock(params: ScoreSpeakingMockParams) {
  const userPrompt = buildUserPrompt(params);
  const { data, provenance, result } = await scoreExam(params, userPrompt);

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
