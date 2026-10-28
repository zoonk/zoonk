import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { decodeHtmlEntities } from "../../_utils/html-entities";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import systemPrompt from "./topic-skill-names.prompt.md";

/** The plan edits' small model: the learner waits on the buddy's card. */
const defaultModel = "google/gemini-3.5-flash-lite";
const fallbackModels = ["anthropic/claude-haiku-5.5", "openai/gpt-6-luna"] as const;

const MAX_NAME_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 200;

const schema = z.object({
  skills: z.array(z.object({ description: z.string(), name: z.string() })),
});

/** May hold details about the learner. */
export type TopicToName = { description: string; name: string; subject: string | null };

export type TopicSkillName = { description: string; name: string };

export type TopicSkillNamesInput = { language: string; topics: readonly TopicToName[] };

export type TopicSkillNamesParams = TopicSkillNamesInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  useFallback?: boolean;
};

function cleanText({ max, text }: { max: number; text: string }): string {
  return decodeHtmlEntities(text)
    .replaceAll(/\s*[—–]\s*/gu, ", ")
    .replaceAll(/\s+/gu, " ")
    .trim()
    .replace(/\.$/u, "")
    .slice(0, max);
}

/** Never the topic's own words: they may name the learner's teacher, school or test. */
function toSkillNames({
  count,
  raw,
}: {
  count: number;
  raw: z.infer<typeof schema>;
}): (TopicSkillName | null)[] {
  return Array.from({ length: count }, (_, index) => {
    const skill = raw.skills[index];
    const name = skill ? cleanText({ max: MAX_NAME_LENGTH, text: skill.name }) : "";

    if (!skill || name.length === 0) {
      return null;
    }

    const description = cleanText({ max: MAX_DESCRIPTION_LENGTH, text: skill.description });
    return { description: description ? `${description}.` : "", name };
  });
}

function formatTopics(topics: readonly TopicToName[]): string {
  return topics
    .map(
      (topic, index) =>
        `${index + 1}. ${topic.name} | ${topic.description} | ${topic.subject ?? "none"}`,
    )
    .join("\n");
}

function buildUserPrompt(input: TopicSkillNamesInput): string {
  return `
    LANGUAGE: ${getPromptLanguageName({ language: input.language })}

${formatUntrustedInput({ TOPICS: formatTopics(input.topics) })}
  `;
}

/**
 * Named as a course catalog would, with nothing of the learner's own, so the shared skill fits
 * anyone: "Fill in the organelles table for Ms. Ana's test" becomes "Fill in comparison tables of
 * cell organelles".
 */
export async function nameTopicSkills(
  params: TopicSkillNamesParams,
): Promise<{
  data: (TopicSkillName | null)[];
  provenance: Awaited<ReturnType<typeof runTaskGeneration>>["provenance"];
  systemPrompt: string;
  usage: Awaited<ReturnType<typeof runTaskGeneration>>["result"]["usage"];
  userPrompt: string;
}> {
  const { analytics, model = defaultModel, reasoning, useFallback = true } = params;
  const userPrompt = buildUserPrompt(params);
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
    task: "topic-skill-names",
  });

  const data = toSkillNames({ count: params.topics.length, raw: result.output });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
