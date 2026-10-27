import "server-only";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { mapJsonStrings } from "@zoonk/utils/json";
import { replaceEmDashes } from "@zoonk/utils/string";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { selectPromptVariants } from "../../_utils/prompt-variants";
import {
  type ConversationTurn,
  formatConversationTranscript,
} from "./_utils/conversation-transcript";
import {
  SPEAKING_EXAM_VARIETIES,
  type SpeakingExam,
  type SpeakingMockExam,
} from "./exam-speaking-exams";
import {
  type SpeakingCriterion,
  type SpeakingGrade,
  listRatedCriteria,
  toSpeakingGrade,
} from "./speaking-bands";
import cambridgeRubric from "./speaking-score-cambridge.prompt.md";
import deleRubric from "./speaking-score-dele.prompt.md";
import delfRubric from "./speaking-score-delf.prompt.md";
import goetheRubric from "./speaking-score-goethe.prompt.md";
import ieltsRubric from "./speaking-score-ielts.prompt.md";
import toeflRubric from "./speaking-score-toefl.prompt.md";
import basePrompt from "./speaking-score.prompt.md";

/**
 * Runs once per mock or exam task, and the learner waits for it on the results screen. Merged from
 * the IELTS and TOEFL mock grader and the certificate task grader (27 Oct 2026), and judged with
 * one rubric against the old graders' saved outputs, Luna scored 8.69 on six IELTS (old 8.08), 8.50
 * on four TOEFL (8.48), 9.08 on Cambridge (8.62), 9.23 on Goethe (8.92) and 7.77 on DELE (8.46;
 * 8.2 over four runs, and 8.35 with the certificate prompt it replaced), at 23s p50 and $1.04 per 1k
 * runs. Gemini 3.1 Flash Lite scored 7.12 on IELTS at 3.2s, still overrating and misquoting.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash"] as const;

/** The rules every rating shares, with English examples for English exams, then the exam's scale and criteria. */
function withRubric({ english, rubric }: { english: boolean; rubric: string }): string {
  return `${selectPromptVariants({ template: basePrompt, variants: { english } })}\n${rubric}`;
}

const SYSTEM_PROMPTS: Record<SpeakingExam | SpeakingMockExam, string> = {
  cambridge: withRubric({ english: true, rubric: cambridgeRubric }),
  dele: withRubric({ english: false, rubric: deleRubric }),
  delf: withRubric({ english: false, rubric: delfRubric }),
  goethe: withRubric({ english: false, rubric: goetheRubric }),
  ielts: withRubric({ english: true, rubric: ieltsRubric }),
  toefl: withRubric({ english: true, rubric: toeflRubric }),
};

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the evidence comes before the band it supports, the tip last. */
const criterionSchema = z.object({
  evidence: z.string(),
  bandLow: z.number(),
  bandHigh: z.number(),
  tip: z.string(),
});
/* oxlint-enable eslint/sort-keys */

export type ScoreSpeakingParams = {
  exam: SpeakingExam | SpeakingMockExam;
  /** The exam as learners name it: "IELTS Speaking", "DELE B2", "B2 First". */
  title: string;
  /** The level a certificate tests; IELTS and TOEFL rate every level on one scale. */
  level?: CefrLevel;
  /** The task practiced (a mock practices the whole test), with its official speaking time in minutes. */
  task: {
    brief: string;
    minutes: { max: number; min: number };
    name: string;
    role: "examiner" | "partner";
  };
  /**
   * The criteria this task is rated on, in the order the result lists them. Typed replies aren't
   * rated on the ones only the voice shows.
   */
  criteria: readonly SpeakingCriterion[];
  /** The voice model is the "character" and the candidate the "learner". Candidate turns are untrusted. */
  turns: ConversationTurn[];
  /** How long the candidate spoke in total. */
  spokenSeconds: number;
  learnerLanguage: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/** One key per criterion, in order, so the model can't skip or repeat one, then the focus. */
function buildSchema(criteria: readonly SpeakingCriterion[]) {
  const keys = criteria.map((criterion) => criterion.key);
  const [first = "", ...rest] = keys;

  return z.object({
    ...Object.fromEntries(keys.map((key) => [key, criterionSchema])),
    focus: z.enum([first, ...rest]),
  });
}

function describeBands(criterion: SpeakingCriterion): string {
  const half = criterion.halfBands ? ", half bands allowed" : "";

  const level =
    criterion.levelBand === null ? "" : `, band ${criterion.levelBand} describes the exam's level`;

  const scope = criterion.scope === "test" ? "; rated once for the whole paper" : "";
  return `bands ${criterion.minBand ?? 0} to ${criterion.maxBand}${half}${level}${scope}`;
}

function formatCriteria(criteria: readonly SpeakingCriterion[]): string {
  return criteria
    .map(
      (criterion) => `    - \`${criterion.key}\` "${criterion.name}": ${describeBands(criterion)}`,
    )
    .join("\n");
}

/** A call where the candidate spoke for no time but has replies was typed, with no microphone. */
function formatSpokenTime(spokenSeconds: number): string {
  const seconds = Math.round(spokenSeconds);
  return seconds > 0 ? `CANDIDATE_SPOKEN_SECONDS: ${seconds}` : "CANDIDATE_TYPED: true";
}

function buildUserPrompt(
  params: ScoreSpeakingParams & { rated: readonly SpeakingCriterion[] },
): string {
  const transcript = formatConversationTranscript({
    labels: {
      character: params.task.role === "partner" ? "PARTNER" : "EXAMINER",
      learner: "CANDIDATE",
    },
    turns: params.turns,
  });

  const lines = [
    `EXAM: ${params.title}`,
    `TASK: ${params.task.name}`,
    `TASK_BRIEF: ${params.task.brief}`,
    params.level && `LEVEL: ${params.level}`,
    `CRITERIA:\n${formatCriteria(params.rated)}`,
    `TARGET_LANGUAGE: ${SPEAKING_EXAM_VARIETIES[params.exam]}`,
    `LEARNER_LANGUAGE: ${getPromptLanguageName({ language: params.learnerLanguage })}`,
    formatSpokenTime(params.spokenSeconds),
  ].filter(Boolean);

  return `${lines.join("\n")}\n\n${formatUntrustedInput({ TRANSCRIPT: transcript })}`;
}

/**
 * Estimates a speaking mock (IELTS, TOEFL) or one task of a certificate's speaking paper (DELE,
 * DELF, Goethe, Cambridge) on the exam's own criteria: a band range for each with the candidate's
 * words as evidence, one concrete tip each, and the criterion to practice next. Pronunciation is
 * rated for intelligibility only, as a wider range: a transcript can't show sound, and typed
 * replies aren't rated on what only the voice shows. Code keeps every range on its scale whatever
 * the model wrote; it's an estimate, never an official score.
 */
export async function scoreSpeaking(params: ScoreSpeakingParams) {
  const { analytics, model = defaultModel, reasoning, useFallback = true } = params;
  const systemPrompt = SYSTEM_PROMPTS[params.exam];
  const { spokenSeconds } = params;
  const rated = listRatedCriteria({ criteria: params.criteria, spokenSeconds });
  const userPrompt = buildUserPrompt({ ...params, rated });
  const schema = buildSchema(rated);
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
      }),
    systemPrompt,
    task: "speaking-score",
  });

  const output = schema.parse(mapJsonStrings(result.output, replaceEmDashes));
  const minMinutes = params.task.minutes.min;

  const data: SpeakingGrade = toSpeakingGrade({
    criteria: rated,
    minMinutes,
    output,
    spokenSeconds,
    turns: params.turns,
  });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
