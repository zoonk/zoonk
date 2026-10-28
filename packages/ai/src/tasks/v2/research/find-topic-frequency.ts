import "server-only";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { type Reasoning } from "../../../provider-options";
import systemPrompt from "./find-topic-frequency.prompt.md";
import { type ResearchSearchTool } from "./research-search-tools";
import { runSearchTask } from "./run-search-task";
import {
  TOPIC_FREQUENCY_LEVELS,
  type TopicFrequencySubject,
  toTopicFrequencyFinding,
} from "./topic-frequency-finding";

export type { TopicFrequencyFinding } from "./topic-frequency-finding";

/** The other past-edition lookups' pair, at low reasoning. */
const defaultModel = "google/gemini-3.8-flash";
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

/**
 * A plan short on time leaves out the topics asked least first. No fallback models: the search tool
 * is tied to the model it's measured with.
 */
export async function findTopicFrequency({
  analytics,
  model = defaultModel,
  reasoning = defaultReasoning,
  searchTool = defaultSearchTool,
  ...input
}: FindTopicFrequencyParams) {
  const userPrompt = buildUserPrompt(input);

  const { isSearched, output, provenance, usage } = await runSearchTask({
    analytics,
    libraryInput: true,
    maxSteps: MAX_STEPS,
    model,
    reasoning,
    schema,
    searchTool,
    systemPrompt,
    task: "find-topic-frequency",
    userPrompt,
  });

  const data = toTopicFrequencyFinding({ isSearched, raw: output, subjects: input.subjects });

  return { data, provenance, systemPrompt, usage, userPrompt };
}
