import "server-only";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { mapJsonStrings } from "@zoonk/utils/json";
import { replaceEmDashes } from "@zoonk/utils/string";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { formatCast } from "../../_utils/cast";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { selectPromptVariants } from "../../_utils/prompt-variants";
import taskPrompt from "./exam-speaking-card.prompt.md";
import {
  SPEAKING_EXAM_LANGUAGES,
  SPEAKING_EXAM_VARIETIES,
  type SpeakingExam,
} from "./exam-speaking-exams";

/**
 * One card per try, written while the learner waits, like a speaking mock's scenario; the same
 * model as the IELTS and TOEFL mock's (`speaking-mock-scenario`), whose eval chose it for exam-like
 * scripts in the target language.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash"] as const;

const MAX_PHOTOS = 5;
const MIN_HINTS = 3;
const MAX_HINTS = 5;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the card before the script that runs it. */
const cardOutputSchema = z.object({
  instructions: z.array(z.string()),
  prompts: z.array(z.string()),
  text: z.object({ title: z.string(), body: z.string() }).nullable(),
  table: z
    .object({ title: z.string(), columns: z.array(z.string()), rows: z.array(z.array(z.string())) })
    .nullable(),
  photos: z.array(z.object({ scene: z.string(), alt: z.string() })).max(MAX_PHOTOS),
  summary: z.string(),
  character: z.object({ name: z.string(), role: z.string(), place: z.string() }),
  characterBrief: z.string(),
  openingLine: z.string(),
  hints: z.array(z.string()).min(MIN_HINTS).max(MAX_HINTS),
});
/* oxlint-enable eslint/sort-keys */

export type ExamSpeakingCardOutput = z.infer<typeof cardOutputSchema>;

/** The card of the earlier task a task continues, as the learner saw it. */
type PreviousCard = Pick<ExamSpeakingCardOutput, "instructions" | "prompts" | "table" | "text"> & {
  task: string;
};

export type GenerateExamSpeakingCardParams = {
  exam: SpeakingExam;
  /** The exam and level as learners name it: "DELE B2", "B2 First". */
  title: string;
  paper: string;
  task: {
    name: string;
    brief: string;
    role: "examiner" | "partner";
    minutes: number;
    stimulus: "data" | "photos" | "text" | "topic";
  };
  previous?: PreviousCard | null;
  level: CefrLevel;
  learnerLanguage: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function buildSystemPrompt(params: GenerateExamSpeakingCardParams): string {
  const { role, stimulus } = params.task;

  return selectPromptVariants({
    template: taskPrompt,
    variants: {
      continues: Boolean(params.previous),
      data: stimulus === "data",
      examiner: role === "examiner",
      partner: role === "partner",
      photos: stimulus === "photos",
      text: stimulus === "text",
    },
  });
}

function formatPrevious(previous: PreviousCard): string {
  return `\n    PREVIOUS_CARD:\n${JSON.stringify(previous, null, 2)}`;
}

function buildUserPrompt(params: GenerateExamSpeakingCardParams): string {
  const previous = params.previous ? formatPrevious(params.previous) : "";

  return `
    EXAM: ${params.title}
    PAPER: ${params.paper}
    TASK: ${params.task.name}
    TASK_BRIEF: ${params.task.brief}
    AI_ROLE: ${params.task.role}
    MINUTES: ${params.task.minutes}
    LEVEL: ${params.level}
    TARGET_LANGUAGE: ${SPEAKING_EXAM_VARIETIES[params.exam]}
    LEARNER_LANGUAGE: ${getPromptLanguageName({ language: params.learnerLanguage })}
    ${formatCast({ language: SPEAKING_EXAM_LANGUAGES[params.exam], seed: `${params.title}:${params.task.name}:${Date.now()}` })}${previous}
  `;
}

/**
 * Generated text never shows em dashes, and only the material the task uses stays: a task without
 * photos gets none drawn, whatever the model wrote.
 */
function repairCard({
  card,
  stimulus,
}: {
  card: ExamSpeakingCardOutput;
  stimulus: GenerateExamSpeakingCardParams["task"]["stimulus"];
}): ExamSpeakingCardOutput {
  const repaired = cardOutputSchema.parse(mapJsonStrings(card, replaceEmDashes));

  return {
    ...repaired,
    photos: stimulus === "photos" ? repaired.photos : [],
    table: stimulus === "data" ? repaired.table : null,
    text: stimulus === "text" ? repaired.text : null,
  };
}

/**
 * Writes one task card of a certificate's speaking paper, like the exam's own sheet: instructions
 * and prompts in the exam's language, the material the task works from (a text, figures or photo
 * scenes to draw), and the script of the examiner or partner the voice model plays. Personal to one
 * try: it holds nothing about the learner.
 */
export async function generateExamSpeakingCard(params: GenerateExamSpeakingCardParams) {
  const { analytics, model = defaultModel, reasoning, useFallback = true } = params;
  const systemPrompt = buildSystemPrompt(params);
  const userPrompt = buildUserPrompt(params);
  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema: cardOutputSchema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    systemPrompt,
    task: "exam-speaking-card",
  });

  const data = repairCard({ card: result.output, stimulus: params.task.stimulus });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
