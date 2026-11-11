import "server-only";
import { z } from "zod";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { type Reasoning } from "../../provider-options";
import systemPrompt from "./find-topic-frequency.prompt.md";
import { type ResearchSearchTool } from "./research-search-tools";
import { runSearchTask } from "./run-search-task";
import {
  TOPIC_FREQUENCY_LEVELS,
  type TopicFrequencySubject,
  toTopicFrequencyFinding,
} from "./topic-frequency-finding";

export type { TopicFrequencyFinding } from "./topic-frequency-finding";

/**
 * Ratings are shared, so completeness wins: at low reasoning on 6 cases (8 Nov 2026), Flash scored
 * 10.00 (EN and PT) at $26.66/1k, and the cheaper families 9.00 to 9.67, missing Biology or rating
 * a brand-new syllabus as if it had a history. Terra also scored 10.00 on the current prompt.
 */
const defaultModel = "google/gemini-3.8-flash";
const fallbackModels = ["openai/gpt-6.1-terra"] as const;
const defaultSearchTool: ResearchSearchTool = "parallel";
const defaultReasoning: Reasoning = "low";

const MAX_STEPS = 8;

const topicSchema = z.object({
  appearances: z.number().int().nullable(),
  level: z.enum(TOPIC_FREQUENCY_LEVELS),
  topic: z.string(),
});

const schema = z.object({
  subjects: z.array(
    z.object({
      basis: z.string(),
      board: z.string().nullable(),
      sourceTitle: z.string().nullable(),
      sourceUrl: z.string().nullable(),
      subject: z.number().int(),
      topics: z.array(topicSchema),
    }),
  ),
});

type FindTopicFrequencyInput = {
  board: string | null;
  exam: string;
  /** Topics in the notice's words. */
  subjects: TopicFrequencySubject[];
  today: string;
};

export type FindTopicFrequencyParams = FindTopicFrequencyInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  searchTool?: ResearchSearchTool;
  useFallback?: boolean;
};

function formatSubjects(subjects: readonly TopicFrequencySubject[]): string {
  return subjects
    .map((subject, index) =>
      [
        `S${index + 1}. ${subject.name}`,
        ...subject.topics.map((topic, topicIndex) => `  S${index + 1}.${topicIndex + 1} ${topic}`),
      ].join("\n"),
    )
    .join("\n");
}

function buildUserPrompt(input: FindTopicFrequencyInput): string {
  return `
    TODAY: ${input.today}

${formatUntrustedInput({
  BOARD: input.board ?? "",
  EXAM: input.exam,
  SUBJECTS: formatSubjects(input.subjects),
})}
  `;
}

/** A plan short on time leaves out the topics asked least first. */
export async function findTopicFrequency({
  analytics,
  model = defaultModel,
  reasoning = defaultReasoning,
  searchTool = defaultSearchTool,
  useFallback,
  ...input
}: FindTopicFrequencyParams) {
  const userPrompt = buildUserPrompt(input);

  const { isSearched, output, provenance, usage } = await runSearchTask({
    analytics,
    fallbackModels,
    libraryInput: true,
    maxSteps: MAX_STEPS,
    model,
    reasoning,
    schema,
    searchTool,
    systemPrompt,
    task: "find-topic-frequency",
    useFallback,
    userPrompt,
  });

  const data = toTopicFrequencyFinding({
    board: input.board,
    isSearched,
    raw: output,
    subjects: input.subjects,
  });

  return { data, provenance, systemPrompt, usage, userPrompt };
}
