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
import {
  type ConversationTurn,
  formatConversationTranscript,
} from "./_utils/conversation-transcript";
import {
  type ExamSpeakingCriterion,
  type ExamSpeakingGrade,
  listRatedCriteria,
  toExamSpeakingGrade,
} from "./exam-speaking-bands";
import { SPEAKING_EXAM_VARIETIES, type SpeakingExam } from "./exam-speaking-exams";
import cambridgeRubric from "./exam-speaking-score-cambridge.prompt.md";
import deleRubric from "./exam-speaking-score-dele.prompt.md";
import delfRubric from "./exam-speaking-score-delf.prompt.md";
import goetheRubric from "./exam-speaking-score-goethe.prompt.md";
import basePrompt from "./exam-speaking-score.prompt.md";

/**
 * Runs once per task, and the learner waits for it on the results screen: the IELTS and TOEFL
 * mock's rater (`speaking-mock-score`), whose eval chose it for ranges within half a band of
 * labeled transcripts and evidence that quotes the candidate.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash"] as const;

/** The rules every task's rating shares, then only the rated exam's scale and criteria. */
const SYSTEM_PROMPTS: Record<SpeakingExam, string> = {
  cambridge: `${basePrompt}\n${cambridgeRubric}`,
  dele: `${basePrompt}\n${deleRubric}`,
  delf: `${basePrompt}\n${delfRubric}`,
  goethe: `${basePrompt}\n${goetheRubric}`,
};

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the evidence comes before the band it supports, the tip last. */
const criterionSchema = z.object({
  evidence: z.string(),
  bandLow: z.number(),
  bandHigh: z.number(),
  tip: z.string(),
});
/* oxlint-enable eslint/sort-keys */

export type ScoreExamSpeakingParams = {
  exam: SpeakingExam;
  /** The exam and level as learners name it: "DELE B2", "B2 First". */
  title: string;
  level: CefrLevel;
  /** The task, with its official speaking time in minutes. */
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
  criteria: readonly ExamSpeakingCriterion[];
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
function buildSchema(criteria: readonly ExamSpeakingCriterion[]) {
  const keys = criteria.map((criterion) => criterion.key);
  const [first = "", ...rest] = keys;

  return z.object({
    ...Object.fromEntries(keys.map((key) => [key, criterionSchema])),
    focus: z.enum([first, ...rest]),
  });
}

function describeBands(criterion: ExamSpeakingCriterion): string {
  const half = criterion.halfBands ? ", half bands allowed" : "";

  const level =
    criterion.levelBand === null ? "" : `, band ${criterion.levelBand} describes the exam's level`;

  const scope = criterion.scope === "test" ? "; rated once for the whole paper" : "";
  return `bands 0 to ${criterion.maxBand}${half}${level}${scope}`;
}

function formatCriteria(criteria: readonly ExamSpeakingCriterion[]): string {
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
  params: ScoreExamSpeakingParams & { rated: readonly ExamSpeakingCriterion[] },
): string {
  const transcript = formatConversationTranscript({
    labels: {
      character: params.task.role === "partner" ? "PARTNER" : "EXAMINER",
      learner: "CANDIDATE",
    },
    turns: params.turns,
  });

  return `
    EXAM: ${params.title}
    TASK: ${params.task.name}
    TASK_BRIEF: ${params.task.brief}
    LEVEL: ${params.level}
    CRITERIA:
${formatCriteria(params.rated)}
    TARGET_LANGUAGE: ${SPEAKING_EXAM_VARIETIES[params.exam]}
    LEARNER_LANGUAGE: ${getPromptLanguageName({ language: params.learnerLanguage })}
    ${formatSpokenTime(params.spokenSeconds)}

${formatUntrustedInput({ TRANSCRIPT: transcript })}
  `;
}

/**
 * Estimates one task of a certificate's speaking paper on the exam's own criteria: a band range for
 * each with the candidate's words as evidence, one concrete tip each, and the criterion to practice
 * next. Pronunciation is rated for intelligibility only, as a wider range: a transcript can't show
 * sound, and typed replies aren't rated on what only the voice shows. Code keeps every range on its
 * scale whatever the model wrote; it's an estimate, never an official score.
 */
export async function scoreExamSpeaking(params: ScoreExamSpeakingParams) {
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
    task: "exam-speaking-score",
  });

  const output = schema.parse(mapJsonStrings(result.output, replaceEmDashes));
  const minMinutes = params.task.minutes.min;

  const data: ExamSpeakingGrade = toExamSpeakingGrade({
    criteria: rated,
    minMinutes,
    output,
    spokenSeconds,
    turns: params.turns,
  });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
