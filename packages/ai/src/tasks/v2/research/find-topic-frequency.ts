import "server-only";
import { Output, generateText, isStepCount } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import systemPrompt from "./find-topic-frequency.prompt.md";
import {
  type ResearchSearchTool,
  buildResearchSearchTools,
  collectSearchedHosts,
  isOnSearchedHost,
} from "./research-search-tools";
import {
  TOPIC_FREQUENCY_LEVELS,
  type TopicFrequencySubject,
  toTopicFrequencyFinding,
} from "./topic-frequency-finding";

export type { TopicFrequencyFinding } from "./topic-frequency-finding";

/**
 * The pair the other past-edition lookups use (`find-subject-questions`, `find-course-weights`:
 * Gemini 3.8 Flash with Parallel), at low reasoning: research runs it once per exam, beside them.
 */
const defaultModel = "google/gemini-3.8-flash";
const defaultSearchTool: ResearchSearchTool = "parallel";
const defaultReasoning: Reasoning = "low";

/** A few searches for each of a handful of subjects, and the answer. */
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
  /** The exam and, when it has phases or roles, the learner's ("OAB…, 1ª fase"). */
  exam: string;
  /** The subjects to rank, each with its topics in the notice's words. */
  subjects: TopicFrequencySubject[];
  /** The learner-local date, YYYY-MM-DD. */
  today: string;
};

export type FindTopicFrequencyParams = FindTopicFrequencyInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  searchTool?: ResearchSearchTool;
};

/** Each subject numbered, with its topics under ids ("S2.5"), as the prompt reads them. */
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
 * Looks up how often an exam asked each topic of some of its subjects in recent editions, from
 * analyses of its past papers (ENEM's genetics every year, its gravitation rarely), for a notice
 * whose documents don't say: a plan short on time leaves out the topics asked least first. Only
 * one source per subject, on a page a search returned, rating the subject's own topics, is kept;
 * anything else is left out, never guessed. Fallback models aren't used: the search tool is tied
 * to the model it's measured with.
 */
export async function findTopicFrequency({
  analytics,
  model = defaultModel,
  reasoning = defaultReasoning,
  searchTool = defaultSearchTool,
  ...input
}: FindTopicFrequencyParams) {
  const userPrompt = buildUserPrompt(input);
  const providerOptions = buildProviderOptions({ fallbackModels: [], model, useFallback: false });

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
        stopWhen: isStepCount(MAX_STEPS),
        tools: buildResearchSearchTools({ model, searchTool }),
      }),
    promptVersion: `search:${searchTool}`,
    systemPrompt,
    task: "find-topic-frequency",
  });

  const hosts = collectSearchedHosts({
    sources: result.sources,
    toolResults: result.steps.flatMap((step) => step.toolResults),
  });

  const data = toTopicFrequencyFinding({
    isSearched: (url) => isOnSearchedHost({ hosts, url }),
    raw: result.output,
    subjects: input.subjects,
  });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
